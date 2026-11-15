# querypipe

## 0.1.1

### Patch Changes

- Boundary hardening and filter removal (ADR-0012). No wire-format change; the export lists are unchanged.

  **New**

  - `removeFilter(field, op?)`, `clearFilters()` and `clearSorts()` on the builder. `filter()` still always appends; replace a condition with `removeFilter(...).filter(...)`.
  - `guards.maxLimit` — opt-in cap on the `limit` a wire may request. A breach is `VALUE_TOO_LONG` with `field: "limit"`. It never adds a limit to a query that has none. Default: no cap.
  - `guards.maxErrors` (default 50) — parse/validate return at most this many errors, the first ones in input order.

  **Fixed**

  - Integers outside ±(2^53 − 1) are now `INVALID_VALUE` instead of being silently rounded to a neighbouring value (`id:eq:9007199254740993` used to match `…992`). Declare such identifiers as `stringField()`.
  - Impossible calendar days (`2024-02-31`, `2023-02-29`) are now `INVALID_VALUE`; they were accepted and rolled over to the next month.
  - `validateQuerySpec` now reports `UNKNOWN_FIELD` for names inherited from `Object.prototype` (`constructor`, `__proto__`, …) instead of `NOT_FILTERABLE` / `NOT_SORTABLE`.
  - Unknown field names, segment keys and operator tokens echoed in `error.field` / `error.op` are truncated to 64 characters + `…`, so error size no longer scales with input size.

  **Behavior changes to be aware of**

  - Inputs with unsafe integers or impossible dates that v0.1.0 accepted are now rejected. They were never executed as written.
  - A single parse/validate that produces more than 50 errors now returns the first 50. Raise `guards.maxErrors` to get more.

## 0.1.0

Initial release — the contract: field schema DSL, immutable builder with progressive sorting, parse / stringify / canonicalize, validation with guards, client-side `apply`, and the conformance suite.
