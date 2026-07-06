# ADR-0007 — Canonical string format: escaping & canonicalization

Status: Accepted (v0.1.0). Normative grammar: [`docs/spec/query-string.md`](../spec/query-string.md).

## Context

The string format is the URL-facing face of QuerySpec:

```
sort=price:desc,stock:asc&filter=price:between:1000,5000;category:in:phone,laptop;deletedAt:isNull&offset=30&limit=30
```

It must round-trip losslessly (values may contain the grammar's own separators), be deterministic (cache keys, ETags, snapshot tests), and be reproducible byte-for-byte by the Java port.

## Decision

1. **Structure.** Segments join with `&` as `key=value`; keys are exactly `sort`, `filter`, `offset`, `limit`, `cursor`, `version`. Sort items split on `,` as `field:direction[:nullsfirst|nullslast]`. Filter items split on `;` as `field:op[:v1,v2,…]`. `isNull`/`notNull` take **no** value part (`deletedAt:isNull` is valid; `deletedAt:isNull:true` ⇒ `INVALID_VALUE`). `between` takes exactly two values, `in`/`notIn` at least one, all other valued operators exactly one.

2. **Escaping.** Values are percent-encoded. The mandatory encode set is the grammar-structural characters plus the two query-string-structural characters:

   | char | encoding |
   | ---- | -------- |
   | `%` | `%25` |
   | `,` | `%2C` |
   | `;` | `%3B` |
   | `:` | `%3A` |
   | `&` | `%26` |
   | `=` | `%3D` |

   The decoder accepts **any** valid `%XX` sequence (UTF-8, so over-encoded inputs like `%41` → `A` are legal); a `%` not followed by two hex digits, or bytes that do not form valid UTF-8, ⇒ `INVALID_VALUE`. `+` is a literal plus and space is a literal space at this layer — querypipe speaks RFC 3986-style percent-encoding, **not** `application/x-www-form-urlencoded`; transports that encode space as `+` must decode before handing the string to `parseQuery`. Because `%` is always encoded, an outer URL-encoding layer (e.g. `URLSearchParams`) composes losslessly on top.

3. **Tokens vs values.** Only value tokens (and `cursor`) are percent-decoded. Field, operator, direction and nulls tokens are matched raw and case-sensitively (`price:DESC` ⇒ `INVALID_VALUE`, `price:LIKE:x` ⇒ `INVALID_OPERATOR`). Field identifiers are restricted to `[A-Za-z_][A-Za-z0-9_]*` (dots reserved for v0.2 nested paths), so they never need encoding.

4. **Canonical output.** `stringifyQuery` is deterministic:
   - segment order: `sort`, `filter`, `offset`, `limit`, `cursor`, `version`; empty segments omitted; empty spec ⇒ `""`;
   - sorts ordered by `(priority, array index)`; direction always explicit; `nulls` emitted only when set;
   - filters in spec order (never re-sorted — user intent and readability win over normalization);
   - encoding exactly the six-character set above, uppercase hex;
   - numbers in minimal decimal form (ADR-0011), dates as their validated ISO strings (not normalized across ISO variants).

5. **Lenient input, canonical output.** The parser additionally accepts: segments in any order, omitted sort direction (`sort=price` ≡ `price:asc`), lowercase hex in percent-escapes, and over-encoding. It rejects (all `INVALID_VALUE`): empty segments/items, duplicate segment keys, duplicate sort fields, malformed `key=value`, unknown keys (`UNKNOWN_FIELD`).

6. **Round-trip laws** (conformance properties #1a/#1b, vectors pin both):
   - for every canonical spec: `parse(stringify(spec))` deep-equals `spec`;
   - for every accepted input: `stringify(parse(input))` is idempotent — `canonicalize ∘ canonicalize = canonicalize`.

7. `alias` is the field's **wire name** in this format: when set, the alias is the only accepted token and the emitted token (using the internal name on the wire is `UNKNOWN_FIELD` — one spelling per field, no drift). The JSON wire format ignores aliases (ADR-0001 §8).

## Consequences

- Canonical strings are stable cache keys; two equivalent inputs converge after one `canonicalize`.
- The 6-char escape set is trivial to port (a 6-entry table + a generic `%XX` decoder) — no dependency on any URL library's quirks in either language.
- Strictness rules make fuzzing tractable: every input is either accepted with a canonical form or rejected with a coded error, never "fixed up" silently beyond the documented leniencies.
