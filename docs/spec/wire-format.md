# QuerySpec JSON wire format (v1) — normative

Decision records: [ADR-0001](../adr/0001-queryspec-wire-format.md), [ADR-0011](../adr/0011-java-portability.md). This is the language-independent JSON projection of `QuerySpec` exchanged between clients, servers and the Java port.

## Shape

```json
{
  "filters": [
    { "kind": "condition", "field": "price", "op": "between", "value": [1000, 5000] },
    { "kind": "condition", "field": "category", "op": "in", "value": ["phone", "laptop"] },
    { "kind": "condition", "field": "deletedAt", "op": "isNull" }
  ],
  "sorts": [
    { "field": "price", "direction": "desc", "priority": 1 },
    { "field": "stock", "direction": "asc", "nulls": "last", "priority": 2 }
  ],
  "offset": 30,
  "limit": 30
}
```

## Rules

1. `filters` and `sorts` are always present (possibly `[]`). Optional members (`limit`, `offset`, `cursor`, `version`, `nulls`, `value`) are **omitted** when unset — never `null`.
2. Every filter node carries the `kind` discriminator (`"condition"` | `"group"`). Missing/unknown `kind` ⇒ `INVALID_VALUE`. v0.1 engines reject `"group"` nodes with a structured `INVALID_VALUE` (reserved for v0.3); the shape above never changes when groups unlock.
3. Field names are always **internal** schema names. String-format aliases never appear in JSON.
4. Values are typed JSON — never coerced: numbers as finite JSON numbers with `|n| ≤ 2^53 − 1` (larger integers are not exactly representable — use a string field for such identifiers; ADR-0012 §3), booleans as JSON booleans, dates as ISO-8601 strings (`YYYY-MM-DD` or datetime with mandatory `Z`/offset, and a real calendar date — ADR-0012 §4), enum/custom values as strings. `"5"` on a number field ⇒ `INVALID_VALUE`.
5. `isNull`/`notNull` conditions must not carry a `value` member. `between` carries a 2-element array; `in`/`notIn` a non-empty array.
6. `direction` ∈ `"asc" | "desc"`, `nulls` ∈ `"first" | "last"`, `logic` ∈ `"and" | "or"` — exact lowercase literals (Java maps enums with explicit wire names).
7. `priority` is an integer ≥ 1. Canonical producers emit contiguous `1..n`; consumers order by `(priority, array index)`.
8. `limit`/`offset` are integers ≥ 0. `offset` and `cursor` are mutually exclusive ⇒ `CONFLICTING_PAGINATION`. A `limit` above the schema's `maxLimit` guard (when set) ⇒ `VALUE_TOO_LONG` with `field: "limit"`.
9. `version` is reserved for spec migrations; v0.1 accepts only `1` (or absent) and passes it through.
10. Root-level `filters` combine with AND (v0.1).

Errors serialize as `{ "code", "field"?, "op"?, "message", "position"? }` inside `{ "ok": false, "errors": [...] }`; success as `{ "ok": true, "value": ... }`. `message` wording is not normative (ADR-0003 §6). The `errors` array holds at most `maxErrors` entries (default 50), and raw tokens echoed in `field`/`op` are truncated to 64 UTF-16 code units + `…` (ADR-0012 §2).
