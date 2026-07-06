# ADR-0003 — Result-based structured errors; no-throw data path

Status: Accepted (v0.1.0)

## Context

Query strings arrive from untrusted wires. A backend must be able to reject a malformed query with a structured 400 body without try/catch choreography, and it must see *all* problems at once (a UI fixing one error per round-trip is hostile). At the same time, programmer misuse of a typed API (wrong field name from plain JS) is a bug, not data — hiding it in a Result would bury it.

## Decision

1. **Data-path functions never throw.** `parseQuery`, `validateQuerySpec`, `stringifyQuery`, `canonicalize`, `applyQuery` and `query.withSpec` return

   ```ts
   type QueryResult<T> = { ok: true; value: T } | { ok: false; errors: QueryError[] };
   ```

   narrowed with the exported `isOk` / `isErr` guards. No exceptions, no sentinel values.

2. **Construction-path misuse throws `TypeError`.** `createQuery` (invalid field/alias identifiers, duplicate wire names, unknown `stableBy`) and typed builder methods called with schema-invalid arguments from untyped code (unknown field, operator not applicable to the field kind, structurally wrong value) throw immediately. These are programmer errors that TypeScript already prevents at compile time; throwing keeps plain-JS failures loud and keeps builders valid by construction (ADR-0002 §5). This is *not* a throw-based error flow: no data ever travels through exceptions.

3. Error shape (wire-safe, Java-safe):

   ```ts
   type QueryError = {
     code: QueryErrorCode;   // machine-readable, closed set
     field?: string;         // internal field name, or the offending raw token/segment key
     op?: string;            // raw operator token (may be an invalid one)
     message: string;        // human-readable, English, NOT part of the conformance contract
     position?: number;      // 0-based UTF-16 code-unit index into the exact parse input, best effort
   };
   ```

   `QueryErrorCode` is the closed set: `UNKNOWN_FIELD`, `NOT_SORTABLE`, `NOT_FILTERABLE`, `INVALID_OPERATOR`, `INVALID_VALUE`, `MAX_SORT_EXCEEDED`, `MAX_FILTER_EXCEEDED`, `VALUE_TOO_LONG`, `CONFLICTING_PAGINATION`.

4. Code assignment rules (normative; vectors pin these):
   - Unknown schema field (or unknown wire alias, or unknown top-level segment key such as `page=`) ⇒ `UNKNOWN_FIELD`.
   - Known field used in `sort` with `sortable: false` ⇒ `NOT_SORTABLE`; in `filter` with `filterable: false` ⇒ `NOT_FILTERABLE`.
   - Operator token outside the closed `Operator` set, or a valid operator applied to a field kind that does not support it (e.g. `contains` on a number field) ⇒ `INVALID_OPERATOR`.
   - Everything value/shape-related ⇒ `INVALID_VALUE`: wrong arity (`between` ≠ 2 values, value present on `isNull`/`notNull`), unparseable typed value, malformed segment, duplicate segment/sort field, invalid percent-encoding, unsupported `version`, `kind:"group"` in v0.1, cursor in client `apply`.
   - Guard breaches ⇒ `MAX_SORT_EXCEEDED`, `MAX_FILTER_EXCEEDED`, `VALUE_TOO_LONG` (ADR-0006 maps `maxInItems` onto `VALUE_TOO_LONG` with `op` set).
   - `cursor` and `offset` together ⇒ `CONFLICTING_PAGINATION`.

5. **Multi-error collection.** Parsing and validation continue past the first failure and return every independent error (order = input order). One malformed filter item does not mask the next.

6. `message` is intentionally excluded from conformance matching (implementations word it freely; the Java port localizes differently). `code`, `field`, `op`, `position` are the machine contract.

## Consequences

- Backends map `isErr` straight to a 400 payload; the error array is already JSON-serializable.
- **Size trade-off (decided per the priority rule):** multi-error collection, best-effort positions, human-readable messages and eager construction validation are the dominant bundle cost. v0.1 measures ~7.4 KiB min+gzip against the original 6 KiB goal; cutting further would drop the contractual behaviors above, which serve higher priorities (portability, type safety). The CI gate is therefore set at 8 KiB; 6 KiB stays a tracked goal with identified candidates (opt-out position tracking, build-time message stripping to codes, splitting `apply` execution from the parse/validate boundary).
- `QueryResult` maps to a small sealed class in Java (`Ok`/`Err`) — no exception-signature impedance.
- Two failure regimes must be documented prominently (throwing constructors vs Result boundaries); the line is mechanical: *schema misuse throws, data errors return*.
- Positions are best effort (token start where cheap, segment start otherwise) and are only asserted in vectors where stable.
