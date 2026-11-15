# ADR-0006 — Guard limits & injection safety

Status: Accepted (v0.1.0)

## Context

parse/validate sit on an untrusted boundary. Without limits, a hostile query string can demand a 40-column sort, a 10 000-item `IN` list, or megabyte values — cheap to send, expensive to execute. Guards make the engine "backend-safe by default" while staying configurable.

## Decision

1. Guard configuration (per schema, `createQuery({ guards })`):

   | Guard | Default | Meaning |
   | ----- | ------- | ------- |
   | `maxSortColumns` | 3 | Max user-specified sort conditions (tie-breaker injection excluded, ADR-0005 §6). |
   | `maxFilters` | 10 | Max filter **conditions** (leaf count — future groups count their leaves, keeping the guard meaningful in v0.3). |
   | `maxValueLength` | 256 | Max length of any single decoded value, measured in UTF-16 code units on the value's string form (`String(number)`, `"true"/"false"`, ISO date string, raw string). Applies to each `in` item and to `cursor`. |
   | `maxInItems` | 100 | Max items in an `in`/`notIn` list. |

   v0.1.1 adds two guards — `maxLimit` (page-size cap, default none) and `maxErrors` (error-list cap, default 50); see [ADR-0012](0012-boundary-hardening.md) §1–2.

2. Error-code mapping (codes are a closed set, ADR-0003):
   - `maxSortColumns` breach ⇒ `MAX_SORT_EXCEEDED` (single error for the segment, not one per extra column).
   - `maxFilters` breach ⇒ `MAX_FILTER_EXCEEDED` (single error).
   - `maxValueLength` breach ⇒ `VALUE_TOO_LONG` (per offending value, `field`/`op` set).
   - `maxInItems` breach ⇒ `VALUE_TOO_LONG` with `op: "in" | "notIn"` — the list *is* the oversized value. The message names `maxInItems`; no new code is introduced for it.

3. **Enforcement points: `parseQuery` and `validateQuerySpec` only** (and therefore `stringifyQuery`/`applyQuery`, which validate external specs first). Builder mutations do not enforce guards (ADR-0002 §7): guards protect the inbound boundary; local code validates before sending if it cares. Guards never throw — breaches surface as Result errors (conformance property #5).

4. **Pattern-injection safety.** `contains`/`startsWith`/`endsWith` values are plain literals end to end:
   - client-side `apply` matches with `String.prototype.includes/startsWith/endsWith` — no RegExp is ever constructed from user input;
   - adapters MUST escape target wildcards before embedding values in `LIKE`/`$regex` (contractual, ADR-0004 §3).
   Combined with parametrized SQL, no query value can change the shape of the executed query.

5. Numeric hygiene: `limit`/`offset` parse as non-negative base-10 integers only; spec numbers must be finite (no `NaN`/`Infinity` across the wire, ADR-0011). Structural caps (`maxFilters`, `maxSortColumns`, `maxValueLength`) bound total parse work linearly in input size.

## Consequences

- A default-configured backend endpoint is safe to expose directly; hardening is opt-*out* (raising limits), not opt-in.
- Reusing `VALUE_TOO_LONG` for `maxInItems` keeps `QueryErrorCode` closed until a real need for a new code appears (wire compatibility with the Java port is cheaper to keep than to restore).
- Guards are part of the schema, so client and server compiled from the same schema definition reject over-limit queries identically — the client can pre-validate for free.
