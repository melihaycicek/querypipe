# Architecture Decision Records — querypipe

querypipe is *a typed query behavior engine for filtering, progressive multi-sorting, pagination and backend-safe query generation*. It manages the **contract** applied to data (QuerySpec), never the data itself. These ADRs freeze the v0.1.0 architecture; the JSON wire format and the conformance test vectors are the language-independent source of truth shared with the future Java port (querypipe-java).

When a design decision is ambiguous, the priority order is:

1. Portability to the Java port
2. Type safety
3. Bundle size
4. API ergonomics

| ADR | Title | Status |
| --- | ----- | ------ |
| [0001](0001-queryspec-wire-format.md) | Canonical QuerySpec model & `kind`-discriminated FilterNode AST | Accepted |
| [0002](0002-immutable-builder.md) | Immutable builder & progressive sort semantics | Accepted |
| [0003](0003-error-model.md) | Result-based structured errors; no-throw data path | Accepted |
| [0004](0004-adapter-interface.md) | Adapter interface contract (reserved for v0.2) | Accepted |
| [0005](0005-tie-breaker.md) | Deterministic tie-breaker (`stableBy`) injection | Accepted |
| [0006](0006-guards.md) | Guard limits & injection safety | Accepted |
| [0007](0007-string-format.md) | Canonical string format: escaping & canonicalization | Accepted |
| [0008](0008-reference-comparator.md) | Reference comparator: SQL ORDER BY model & NULL semantics | Accepted |
| [0009](0009-standard-schema.md) | Optional value validation via Standard Schema | Accepted |
| [0010](0010-dialect-plugins.md) | Syntax dialect plugin interface (reserved for v0.2) | Accepted |
| [0011](0011-java-portability.md) | Java portability constraints | Accepted |

Related specifications (normative):

- [`docs/spec/query-string.md`](../spec/query-string.md) — canonical string grammar
- [`docs/spec/wire-format.md`](../spec/wire-format.md) — JSON wire format
- [`docs/spec/test-vectors.md`](../spec/test-vectors.md) — conformance vector format
- [`docs/api/public-api.d.ts`](../api/public-api.d.ts) — frozen public API surface
