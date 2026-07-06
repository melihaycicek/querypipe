# ADR-0001 — Canonical QuerySpec model & `kind`-discriminated FilterNode AST

Status: Accepted (v0.1.0)

## Context

QuerySpec is the single contract shared by the fluent builder, the string parser, client-side `apply`, future adapters (Prisma/SQL/Mongo/TanStack) and the future Java port. It must survive the v0.3 introduction of OR groups **without changing shape**, and it must deserialize unambiguously in statically-typed languages (Jackson/Gson polymorphic deserialization needs an explicit discriminator).

## Decision

1. `QuerySpec.filters` is `FilterNode[]`, **not** `FilterCondition[]`. The AST is open to grouping from day one:

   ```ts
   type FilterNode = FilterCondition | FilterGroup;

   type FilterCondition = { kind: "condition"; field: string; op: Operator; value?: unknown };
   type FilterGroup     = { kind: "group"; logic: "and" | "or"; children: FilterNode[] };
   ```

2. The `kind` discriminator is **mandatory** on every node, including in the JSON wire format. A node without a valid `kind` is rejected with `INVALID_VALUE` ("missing or unknown kind discriminator"). Rationale: Java polymorphic deserialization and forward-compatible parsers must not infer node type structurally.

3. **v0.1 produces and consumes only `kind: "condition"`.** Root-level nodes combine with implicit AND. `FilterGroup` exists in the type system and the wire format, but:
   - no public API (builder, parser) produces it;
   - `validateQuerySpec` (and therefore `stringifyQuery`/`applyQuery`) rejects it with a structured `INVALID_VALUE` error whose message marks it as reserved for v0.3.

   When OR groups ship in v0.3, only the *acceptance* rule is relaxed — the spec type, wire format and existing vectors do not change. Older engines reject group-bearing specs gracefully with a structured error rather than misinterpreting them.

4. Pagination is canonical as `offset` + `limit`. There is **no `page` field** anywhere in QuerySpec or in the canonical string format. Page-based inputs are a compat dialect concern (ADR-0010) and are normalized to `offset` at the parse boundary.

5. `cursor` and `offset` are mutually exclusive. Both present ⇒ `CONFLICTING_PAGINATION`. `cursor` + `limit` is valid (page size composes with keyset pagination). v0.1 carries `cursor` opaquely (parse/stringify/validate); executing it belongs to v0.2 keyset support (ADR-0004).

6. `version?: number` is a passthrough field reserved for spec migrations (`migrate(spec, migrations)` in v0.2). v0.1 accepts only `version = 1` (or absent); any other value ⇒ `INVALID_VALUE`.

7. `SortCondition.priority` is an explicit, 1-based integer. Canonical specs produced by querypipe APIs always hold a contiguous `1..n` sequence (renormalized on every mutation, ADR-0002). Hand-built specs with gaps are semantically valid; serialization orders by `(priority, array index)`, so re-parsing canonicalizes them.

8. Field names inside QuerySpec are always the **internal** schema names. `alias` is a wire-name concern of the string format only (ADR-0007). The JSON wire format never uses aliases.

## Consequences

- OR groups arrive in v0.3 as a pure API unlock; zero wire-format migration.
- Every consumer must branch on `kind` — enforced by TypeScript narrowing and by Java sealed-interface mapping (ADR-0011).
- Rejecting groups in v0.1 (instead of silently ignoring them) keeps "backend-safe" honest: a spec the engine cannot fully honor is never partially applied.
- `page` never leaks into the contract; UI libraries that think in pages convert at the edges.
