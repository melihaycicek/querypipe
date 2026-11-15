# ADR-0012 — Boundary hardening & filter removal (v0.1.1)

Status: Accepted (v0.1.1)

## Context

A post-release review of v0.1.0 exercised the untrusted boundary with hostile and edge-case input. The architecture held (no throws, no pattern injection, linear parse time), but six gaps showed up between what the ADRs promise and what the engine did:

- `limit` could not be capped. `limit=9007199254740991` parsed cleanly and flowed straight into `take` / `LIMIT`.
- Error output scaled with input. 16 KB of junk segments produced 8 001 errors and a 618 KB JSON body; unknown tokens were echoed back at full length.
- Integers beyond the IEEE-754 safe range were accepted and silently rounded (`id:eq:9007199254740993` became `…992`), so a filter could match a different row than the one asked for.
- "Must be a real date" (query-string spec) was delegated to `Date.parse`, which rolls impossible days over: `2024-02-31` was accepted as March 2. A Java port using `java.time` rejects it — an avoidable cross-language divergence.
- On the JSON path, field lookup went through a plain object, so `"constructor"` or `"__proto__"` resolved to `Object.prototype` members and reported `NOT_FILTERABLE` / `NOT_SORTABLE` instead of `UNKNOWN_FIELD`. Requests were still rejected; only the code was wrong.
- The builder could add filters but never remove one, so every filter UI had to rebuild the query from scratch — and toggle buttons stacked duplicate conditions.

None of these needs a wire-format change. All six are fixed in v0.1.1 under the existing closed error-code set.

## Decision

1. **`maxLimit` guard — opt-in page-size cap.** `createQuery({ guards: { maxLimit } })` rejects a well-formed `limit` greater than `maxLimit` with `VALUE_TOO_LONG` and `field: "limit"`, on both ingress paths.
   - The code follows the ADR-0006 §2 precedent (`maxInItems` and `cursor` length already map onto `VALUE_TOO_LONG`): a guard breach is reported with a guard code, and `QueryErrorCode` stays closed. A malformed limit (negative, fractional) remains `INVALID_VALUE` — the two never fire together.
   - The cap is inclusive and **never injects** a limit: an absent `limit` is not a breach, and parse output is unchanged. Injecting would break the round-trip laws (`stringify(parse(x))` would grow a segment). Applying a default page size is the executor's job (adapters, v0.2).
   - **Default: no cap.** v0.1.1 is a patch release and must not reject input v0.1.0 accepted. Making a finite default the norm is deferred to the next minor (tracked in `docs/IMPROVEMENTS.md`).

2. **Bounded error output.**
   - `maxErrors` guard (default **50**): parse and validate return at most `maxErrors` errors — the first ones, in input order. Collection is still multi-error (ADR-0003 §5); it is merely finite. With default guards a query that is wrong in every position yields far fewer than 50 errors, so legitimate clients never observe the cap.
   - Raw wire tokens echoed in `field` / `op` — unknown field names, unknown segment keys, unknown operator tokens — are truncated to **64 UTF-16 code units followed by `…` (U+2026)**. Declared schema field names are never truncated. 64 covers every identifier a SQL backend can hold (PostgreSQL 63, MySQL 64).
   - Both rules are part of the machine contract and pinned by vectors (`23-error-cap.json`).

3. **Numbers must be exactly representable.** A number value is valid only if `|n| ≤ 2^53 − 1` (in addition to the existing no-exponent rule). This applies after token conversion on the string path and directly on the JSON path, where `2^53` itself is rejected because `2^53 + 1` decodes to the same double. Identifiers that exceed the safe range (snowflake IDs, `BIGINT` keys) must be declared as `stringField`.

4. **Dates are checked against the calendar by the engine.** After the syntax check, the day must not exceed the month's length under the proleptic Gregorian rule (leap years: divisible by 4, except centuries not divisible by 400). Implementations must not rely on a lenient platform parser. Same rule on both ingress paths and in the builder.

5. **Field lookup sees declared fields only.** Names inherited from the host language's base object are never fields. In TypeScript the field table is prototype-less (`Object.create(null)`); a Java port gets this for free from `Map`. `UNKNOWN_FIELD` is the only possible outcome for an undeclared name on every path.

6. **Filter and sort removal on the builder.** Three additive methods, same immutability rules as ADR-0002:

   | Method | Semantics |
   | ------ | --------- |
   | `removeFilter(field, op?)` | Removes every condition on `field`, or only those using `op` when given. Nothing removed ⇒ no-op (same instance). An unknown field or operator is misuse and throws `TypeError`. |
   | `clearFilters()` | Removes all filters. Already empty ⇒ no-op. |
   | `clearSorts()` | Empties the sort chain. Already empty ⇒ no-op. |

   There is deliberately no `setFilter`: "replace" has two reasonable meanings (same field, or same field + operator) and `removeFilter(...).filter(...)` states which one the caller wants. Pagination is not touched by removal — resetting `offset` when filters change is a UI policy.

## Consequences

- **Behavior change for garbage input only.** Inputs newly rejected in v0.1.1 — unsafe integers, impossible calendar days — were never executable as written; v0.1.0 ran a *different* query than the one requested. Everything else is additive or opt-in.
- **Java port:** rules 2–5 are stated in portable terms (UTF-16 code units, `2^53 − 1`, Gregorian month lengths, declared-fields-only lookup) and each has vectors: `18-dates.json`, `20-validate-spec.json`, `21-numeric-safety.json`, `22-limit-guard.json`, `23-error-cap.json`.
- **Bundle size:** +261 B min+gzip (7 536 → 7 797 B), still inside the 8 KiB gate. Headroom is now ~400 B, so the shrink candidates in ADR-0003 §Consequences become relevant before the next feature lands in core.
- ADR-0006's guard table gains two rows (`maxLimit`, `maxErrors`); ADR-0003 §5 is qualified by rule 2. Builder guard enforcement (ADR-0002 §7) is unchanged — the new guards, like the old ones, bind only at parse/validate.
