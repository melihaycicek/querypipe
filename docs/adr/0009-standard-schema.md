# ADR-0009 — Optional value validation via Standard Schema

Status: Accepted (v0.1.0)

## Context

Field kinds give structural typing (number/string/date/boolean/enum), but real APIs want domain constraints: "price is a non-negative number", "category matches this branded type". Zod/Valibot/ArkType all solve this — and all implement the [Standard Schema](https://standardschema.dev) interface (`~standard`), which is explicitly designed to be depended on as a *type-only* contract. querypipe core has a hard zero-runtime-dependency requirement.

## Decision

1. Every field constructor accepts an optional `schema` whose type is a **vendored, type-only copy** of the `StandardSchemaV1` interface (a `~standard: { version: 1, vendor, validate }` property). No import from any validation library exists at runtime or in `package.json`; any spec-compliant library plugs in.

2. **Where it runs:** during `parseQuery` and `validateQuerySpec`, after kind conversion succeeds, per value (each `in` item and each `between` bound individually). During `parseQuery` the validated (possibly transformed) output value replaces the input in the resulting spec — a Standard Schema acting as a normalizer (e.g. trimming) participates in canonicalization *before* stringify sees the value. `validateQuerySpec` checks acceptance only and never rewrites the spec it was given (it returns the input unchanged on ok).

3. **Failure mapping:** issues returned by `~standard.validate` become one `INVALID_VALUE` error per offending value, `field`/`op` set, `message` joined from the issues' messages. Never thrown.

4. **Sync only in v0.1.** Standard Schema permits `Promise` results; querypipe's parse/validate are synchronous by design (they run in hot request paths). If a validator returns a Promise, the value fails with `INVALID_VALUE` and a message stating async validation is unsupported. (An async `parseQueryAsync` can be added later without breaking this contract.)

5. Standard Schema runs on **field-domain filter values only** — never on row data in `apply` (apply is read-only over user rows and must stay O(n log n) with zero surprises), and never on `contains`/`startsWith`/`endsWith` fragments (their domain is "substring", not the field's value domain).

## Consequences

- Zero runtime dependencies and no version coupling: the `~standard` property is the entire integration surface.
- Type-level, the field's value type can be refined by the schema's output type (e.g. a branded `Price`), and `enumField` unions stay narrow.
- The Java port maps the same seam onto a `ValueValidator<T>` functional interface; the *wire* behavior (which inputs fail with `INVALID_VALUE`) is what conformance vectors can pin — vectors themselves avoid library-specific validators and only exercise the seam with the built-in kinds.
