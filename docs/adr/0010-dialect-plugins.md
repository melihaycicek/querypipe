# ADR-0010 — Syntax dialect plugin interface (reserved for v0.2)

Status: Accepted (v0.1.0 — interface design only; **no dialect is implemented in v0.1**)

## Context

The world already speaks several query-string conventions: JSON:API (`sort=-price,name`), OData (`$orderby=price desc`), api-query-params (`price>=100`), and the ubiquitous `page=2&limit=30`. querypipe must interoperate without polluting the canonical grammar (ADR-0007) or the canonical spec (ADR-0001). Compatibility is an *edge* concern: foreign syntax in, canonical QuerySpec out.

## Decision

1. Reserved plugin interface (full typed draft in `docs/api/dialect-v0.2.d.ts`):

   ```ts
   interface SyntaxDialect {
     readonly name: string;                     // "jsonapi", "odata", "page-pagination", ...
     parse(ctx: DialectContext, input: string): QueryResult<QuerySpec>;
     stringify?(ctx: DialectContext, spec: QuerySpec): QueryResult<string>;  // omitted ⇒ read-only dialect
   }
   ```

   Wired as `parseQuery(query, input, { dialect })` / `stringifyQuery(query, spec, { dialect })` in v0.2. `DialectContext` exposes the schema, guards, and the canonical parser/stringifier so dialects can delegate the parts they don't reinterpret.

2. **Dialects are boundary translators, not spec extensions.** Whatever the input syntax, the output is a canonical QuerySpec that passes `validateQuerySpec` unchanged. Dialects cannot add fields, operators or pagination modes to the spec.

3. **Page-based pagination is the flagship dialect, not a spec feature.** The `page-pagination` dialect accepts `page=2&limit=30` and converts at the parse boundary: `offset = (page - 1) * limit` (requires `limit`; `page ≥ 1`; violations ⇒ `INVALID_VALUE`). The canonical spec never contains a `page` field (ADR-0001 §4); its `stringify` direction re-derives `page` only when `offset % limit === 0`, otherwise it reports the spec as not page-representable via a structured error. In v0.1, `page=` hitting the canonical parser fails with `UNKNOWN_FIELD` — a deliberate, documented signal that page semantics require the dialect.

4. Dialect guarantees (contractual): guards are enforced on the *resulting spec* exactly as for canonical parsing (a dialect cannot smuggle 50 sort columns), and error reporting uses the same `QueryError` codes with `position` relative to the dialect's own input.

5. Canonicalization laws apply post-translation: `canonicalize(dialect.parse(x))` is idempotent; dialect round-trips (`stringify ∘ parse`) are only required to be *semantically* stable (same canonical spec), not byte-stable — foreign formats may have their own redundancies.

## Consequences

- The canonical grammar stays small and frozen; compatibility pressure lands in plugins with their own versioning.
- Teams migrating from api-query-params/OData keep their public URLs and adopt querypipe server-side first, then move URLs to canonical form at their own pace.
- The Java port shares the dialect *contract* (same interface shape, same guarantees); individual dialect implementations are per-language but validated by shared semantic vectors in v0.2.
