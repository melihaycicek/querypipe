# ADR-0011 — Java portability constraints

Status: Accepted (v0.1.0)

## Context

querypipe-java will implement the same contract. Portability is priority #1 in the design tie-break rule, so every cross-language surface — the JSON wire format, the string grammar, error codes, comparison semantics — must avoid JavaScript-isms. The shared conformance vectors (JSON fixtures, `docs/spec/test-vectors.md`) are the executable form of this ADR: the Java port must pass the identical files.

## Decision

1. **JSON wire rules for QuerySpec:**
   - Absent optional fields are *omitted*, never `null` and never `undefined` (no `undefined` exists in JSON; TS code must not put `undefined`-valued keys into specs).
   - `kind` discriminator is mandatory on every filter node (Jackson `@JsonTypeInfo`-style polymorphism; ADR-0001).
   - All enum-like strings are the exact TypeScript literals, camelCase where multi-word: `"condition"`, `"group"`, `"and"`, `"or"`, `"asc"`, `"desc"`, `"first"`, `"last"`, and operator tokens `eq … notIn … startsWith … notNull`. Java enums map with explicit `@JsonValue` names — never Java's SCREAMING_CASE on the wire.
   - Values are typed JSON: numbers as JSON numbers, booleans as JSON booleans, dates as ISO-8601 **strings**. `"5"` on a number field is `INVALID_VALUE` — the JSON layer never coerces.

2. **Numbers.** Wire numbers must be finite IEEE-754 doubles (`NaN`/`Infinity` are unrepresentable in JSON and rejected). Canonical *string-format* rendering is minimal decimal: integral values without a trailing `.0` (Java must not emit `Double.toString(5.0)` = `"5.0"`), non-integral values in plain decimal within the guard-bounded range. Conformance vectors only use values whose rendering is trivially identical in both languages (safe integers and short decimals).

3. **Dates.** Accepted wire forms: `YYYY-MM-DD` (compared as UTC midnight) or full ISO-8601 with mandatory `Z`/offset. Timezone-less datetimes are rejected — local-time interpretation is the classic cross-platform divergence. Java: `Instant`/`LocalDate` parsing, same regex gate.

4. **Strings & indices.** Default string comparison is UTF-16 code-unit order — bit-identical between JS (`<`) and Java (`String.compareTo`) (ADR-0008). `QueryError.position` and `maxValueLength` are measured in UTF-16 code units (both languages' native `String` indexing/length) — never code points or bytes.

5. **Result shape.** `QueryResult` is `{ ok: true, value } | { ok: false, errors }` on any serialized boundary; Java models it as a sealed `Result<T>` with the same JSON projection. Error `message` text is explicitly non-normative (ADR-0003 §6) so each language words/localizes freely; `code`/`field`/`op`/`position` are normative.

6. **No JS-only semantics in the contract.** Nothing may depend on: property insertion order beyond documented array orders, `Intl` data (vectors exclude locale collation; ADR-0008), prototype behavior, or regex dialect details (the grammar is spec'd as split/scan rules, not by a reference regex).

7. **Vector-driven development.** Vectors are written *before* implementation and are the arbiter: a divergence between an implementation and a vector is an implementation bug unless an ADR says otherwise. The TS engine adapter in `@querypipe/testing` defines the engine seam (`parse/stringify/canonicalize/validate/apply` over JSON schema definitions) that querypipe-java re-implements to run the same files. `custom` fields (arbitrary comparators) are not JSON-expressible and are excluded from vectors — they are covered by per-language unit tests.

## Consequences

- Any future feature must pass the test: "can this deserialize into a sealed Java type from the same JSON, and can both languages produce byte-identical canonical strings?" If not, it changes shape before it ships.
- The conformance suite doubles as the Java port's acceptance suite from day zero; the port starts from `packages/testing/vectors/`, not from reading TS source.
- Some TS conveniences deliberately stop at the boundary: builder ergonomics, `Date` object inputs (normalized to ISO strings at entry), Standard Schema hooks (seam re-mapped in Java, ADR-0009).
