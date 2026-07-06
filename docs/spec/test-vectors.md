# Conformance test vector format (v1) — normative

Vectors live in `packages/testing/vectors/*.json`. They are **written before the implementation and are the arbiter**: any implementation (TypeScript core, querypipe-java, future adapters' engines) must pass the identical files. A divergence between an implementation and a vector is an implementation bug unless an ADR says otherwise (ADR-0011 §7).

## File shape

```json
{
  "suite": "escaping",
  "description": "What this suite pins down.",
  "specVersion": 1,
  "schema": {
    "stableBy": "id",
    "guards": { "maxSortColumns": 3, "maxFilters": 10, "maxValueLength": 256, "maxInItems": 100 },
    "fields": {
      "id":       { "type": "number" },
      "name":     { "type": "string" },
      "category": { "type": "enum", "values": ["phone", "laptop", "tablet"] },
      "createdAt":{ "type": "date", "alias": "created" },
      "secret":   { "type": "string", "sortable": false, "filterable": false }
    }
  },
  "idField": "id",
  "cases": [ ... ]
}
```

- `schema` is a declarative, language-independent field map. `type` ∈ `number | string | date | boolean | enum`; optional `sortable`/`filterable` (default `true`), `alias`, `values` (enum only). Omitted `guards` (or omitted individual guard keys) mean the engine defaults (3 / 10 / 256 / 100). `custom` fields (arbitrary comparators) and `locale` collation are **not JSON-expressible / not deterministic across ICU builds** and are deliberately excluded from vectors — they are covered by per-language unit tests (ADR-0008, ADR-0011).
- `idField` (default `"id"`) is the row property projected by `apply` expectations.

## Engine seam

An implementation under test exposes five pure operations over `(schema, …)`:
`parse(schema, input)`, `stringify(schema, spec)`, `canonicalize(schema, input)`, `validate(schema, spec)`, `apply(schema, spec, rows)` — each returning `{ ok: true, value } | { ok: false, errors }` (JSON projection). `@querypipe/testing` ships the TS adapter for `querypipe`; querypipe-java implements the same seam.

## Case shapes (`op` selects one)

| `op` | Inputs | Expectation |
| ---- | ------ | ----------- |
| `"parse"` | `input` (string) | `expect.ok` + `expect.spec` (deep JSON equality) or `expect.errors` |
| `"stringify"` | `spec` | `expect.ok` + `expect.output` (exact string) or `expect.errors` |
| `"canonicalize"` | `input` | `expect.ok` + `expect.output`, or `expect.errors`. On ok, the runner **additionally asserts idempotency**: `canonicalize(expect.output) === expect.output`. |
| `"validate"` | `spec` | `expect.ok` (runner asserts the returned value deep-equals the input spec) or `expect.errors` |
| `"apply"` | `spec`, `rows` (array of JSON objects) | `expect.ok` + `expect.ids` (projection of `idField`, exact order) or `expect.errors` |
| `"roundtrip-spec"` | `spec` (must be canonical) | runner asserts `parse(stringify(spec))` deep-equals `spec`; optional `expect.output` additionally pins the canonical string |

Every case has a unique `name` and may carry a free-form `note`.

## Error matching

`expect.errors` is an array of matchers: `{ "code", "field"?, "op"?, "position"? }`.

- `code` is mandatory and must match exactly. `field`, `op`, `position` are compared **only when present in the matcher**.
- `message` is never matched (implementation/language specific; ADR-0003 §6).
- Each matcher must match a **distinct** actual error; by default the actual error count must equal the matcher count (`"exactErrors": false` on the case relaxes this to subset matching).
- Multi-error cases list matchers in input order; matching itself is order-insensitive.

## Deep equality

Specs and rows are compared **after JSON normalization** (serialize → parse): absent members are genuinely absent (never `null`/`undefined`), array order is significant, object key order is not, numbers compare as IEEE-754 doubles.

## Law coverage expected of every implementation

The vector files pin concrete instances of the conformance laws; property-based suites (fast-check in TS) generalize them: (1a) canonical-spec round-trip, (1b) idempotent canonicalization, (2) non-mutating stable apply, (3) apply ≡ reference ORDER BY model, (4) `thenSort` prefix preservation, (5) guard breaches return codes and never throw, (6) idempotent tie-breaker injection, (7) lossless escaping round-trip, (8) `cursor`+`offset` ⇒ `CONFLICTING_PAGINATION`.
