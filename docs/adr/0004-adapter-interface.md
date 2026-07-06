# ADR-0004 — Adapter interface contract (reserved for v0.2)

Status: Accepted (v0.1.0 — interface design only; **no adapter is implemented in v0.1**)

## Context

querypipe is the bridge between URL/UI state and backend query execution — it competes with neither. Adapters translate a validated QuerySpec into target-specific output (Prisma args, parametrized SQL, Mongo filters, TanStack Table state). The interface must be fixed now so that v0.1 consumers can code against the seam and so the tie-breaker/injection-safety obligations are contractual from day one.

## Decision

1. Reserved interface (see `docs/api/adapter-v0.2.d.ts` for the full typed draft):

   ```ts
   interface QueryAdapter<TOutput, TInput = never> {
     readonly name: string;
     /** spec is guaranteed pre-validated against the schema; adapters never re-parse. */
     toTarget(ctx: AdapterContext, spec: QuerySpec): QueryResult<TOutput>;
     /** Optional reverse direction (e.g. fromTanStackState). */
     fromTarget?(ctx: AdapterContext, input: TInput): QueryResult<QuerySpec>;
   }
   ```

   `AdapterContext` carries the resolved field schema (types, aliases, `stableBy`, per-field adapter mapping such as a future `sql` column expression) so adapters stay pure functions.

2. Planned v0.2 adapters: `toPrisma`, `toSQL` (parametrized), `toMongo`, `toTanStackState` **and** `fromTanStackState` (two-way). Keyset pagination (`toCursor(lastRow)` / `applyCursor(cursor)`) builds on the same context and emits multi-column `WHERE (a, b, id) < (?, ?, ?)` predicates over the sort chain + tie-breaker.

3. **Contractual obligations for every adapter** (normative; conformance vectors for adapters will assert them in v0.2):
   - **Tie-breaker injection parity.** If the schema defines `stableBy`, the adapter MUST append it as the final sort column exactly like client-side `apply` does (ADR-0005): only when the sort chain is non-empty, ascending, skipped if already present, idempotent. Client `apply` and generated `ORDER BY` must produce the same total order.
   - **Injection safety.** SQL output is always parametrized — values never interpolate into SQL text. `contains`/`startsWith`/`endsWith` values MUST have target wildcard characters escaped (`%`, `_` for SQL `LIKE`; regex metacharacters for Mongo `$regex`). Raw user input never becomes a pattern language (mirrors ADR-0006 client rule).
   - **NULL semantics parity.** Generated ordering must honor ADR-0008 (explicit `NULLS FIRST/LAST` emission where the target's default differs from the reference model).
   - **Totality.** Adapters return `QueryResult`; an unsupported spec feature yields a structured error, never a partial query.

4. Adapters are separate scoped packages (reserved names: `@querypipe/prisma`, `@querypipe/sql`, `@querypipe/mongo`, `@querypipe/tanstack`), keeping the primary `querypipe` package at zero dependencies and under the size budget.

## Consequences

- v0.1 example apps demonstrate the seam manually (`examples/express-prisma` maps spec → Prisma args by hand with a "this becomes `toPrisma` in v0.2" marker).
- Because `spec` arrives pre-validated, adapters contain zero schema-checking logic — validation lives in one place.
- The two-way TanStack adapter fixes querypipe's positioning: table UI state is a *dialect of the same contract*, not a parallel state store.
- The Java port implements the same interface shape for JPA/Criteria and JDBC targets; obligations §3 are language-independent.
