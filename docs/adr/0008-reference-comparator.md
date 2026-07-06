# ADR-0008 — Reference comparator: SQL ORDER BY model & NULL semantics

Status: Accepted (v0.1.0)

## Context

`apply(rows)` must behave like the `ORDER BY` a backend would generate for the same spec — otherwise optimistic client-side sorting and server results disagree and the UI flickers. There is no real SQL or database anywhere in v0.1: the contract is a **pure-function model of ORDER BY semantics**, implemented twice (core comparator + an independent reference model in `@querypipe/testing`) and cross-checked property-based. NULL ordering differs across engines (PostgreSQL treats NULL as largest; MySQL as smallest), so one model must be fixed.

## Decision

1. **NULL model: PostgreSQL.** NULL compares as *larger than every non-null value*. Therefore by default: `asc` ⇒ nulls last, `desc` ⇒ nulls first. An explicit `nulls: "first" | "last"` on a SortCondition is **absolute** (SQL `NULLS FIRST/LAST`): it fixes placement regardless of direction. Rationale: Postgres is the primary SQL target; "unknowns sink to the bottom of an ascending list" matches user expectations; Java maps directly to `Comparator.nullsLast/nullsFirst`.

2. **NULL class** (what counts as NULL when reading a row): `null`, missing property/`undefined`, `NaN` in a number field, an unparseable value in a date field, and a value whose runtime type does not match the field kind. Rows are untrusted plain objects; degrading mistyped data to NULL is deterministic and never throws. (Filtering is stricter: `isNull` matches only `null`/missing — a garbage string in a date field is *not null*, it is unorderable.)

3. **Per-kind comparison (both nulls non-null):**

   | Field kind | Rule |
   | ---------- | ---- |
   | `number` | Numeric order. |
   | `string` | **UTF-16 code-unit order by default** (`a < b` in JS, `String.compareTo` in Java — bit-identical across platforms). `Intl.Collator(locale, { sensitivity })` is used **only when the field declares a `locale`**; collator instances are cached per `(locale, sensitivity)`. Locale-sensitive ordering is intentionally excluded from cross-language conformance vectors (ICU versions differ); vectors use code-unit fields only. |
   | `date` | Epoch milliseconds (spec values are validated ISO strings; row values leniently via `Date` parsing, unparseable ⇒ NULL class). |
   | `boolean` | `false < true` (SQL convention). |
   | `enum` | **Declaration order** of `enumField([...])` values (SQL enum semantics, and the useful one: `["S","M","L"]` sorts S < M < L, not L < M < S alphabetically). A row value outside the declared set ⇒ NULL class. |
   | `custom` | The user-supplied comparator. The NULL class is handled *before* the comparator is called — user comparators never see null/undefined. |

4. **Stability & determinism.** The compiled comparator returns 0 for full ties; `apply` uses a stable sort (guaranteed by ES2019 `Array.prototype.sort`) over a copied array (`slice().sort`, `toSorted` semantics — never mutates input). With the ADR-0005 tie-breaker, orders are total; without `stableBy`, ties keep input order.

5. **Precompilation.** `apply` compiles the spec once into a comparator chain and a filter predicate (field lookups, direction signs, null rules, collators all resolved up front), then runs the O(n log n) sort with no per-comparison schema work.

6. Filter semantics follow the same model (SQL three-valued logic collapsed to "no match"): comparisons/equality against a NULL-class row value never match (`neq` included, mirroring SQL `NULL != x ⇒ UNKNOWN`); `notIn` excludes NULL rows; `between` is inclusive on both ends; reversed `between` bounds match nothing (SQL parity — not auto-swapped). Operator applicability by kind: valued operators (`eq`…`notIn`) apply to number/string/date/boolean/enum; string operators to string/enum; `isNull`/`notNull` to every kind. `custom` fields are **null-checks-only** in v0.1 — their values are not wire-portable (an arbitrary `T` cannot round-trip the canonical string), so valued operators on them are `INVALID_OPERATOR`; value codecs are a v0.2 field extension.

## Consequences

- Vectors 07–18 pin apply behavior; the fast-check suite verifies `apply` ≡ reference model on arbitrary specs × row sets (property #3).
- Adapters must emit explicit `NULLS FIRST/LAST` where a target's default differs from this model (MySQL always; Postgres only for explicit overrides) — recorded in the adapter contract (ADR-0004 §3).
- Code-unit default collation trades linguistic niceness for bit-identical cross-language determinism; localized sorting is an explicit per-field opt-in with documented conformance limits.
