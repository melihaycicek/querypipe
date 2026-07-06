/**
 * querypipe — SyntaxDialect plugin interface (v0.2 design draft; NOT implemented in v0.1).
 *
 * Normative contract: ADR-0010. Dialects are boundary translators: foreign
 * syntax in, canonical QuerySpec out. They cannot extend the spec (no new
 * fields/operators/pagination modes), guards apply to the resulting spec
 * unchanged, and errors use the standard QueryError codes with `position`
 * relative to the dialect's own input.
 */
import type { QueryResult, QuerySpec } from "querypipe";

export interface DialectContext {
  /** Wire-name → internal-name resolution table (aliases included). */
  readonly resolveField: (wireName: string) => string | undefined;
  /** Delegate for the parts a dialect does not reinterpret. */
  readonly canonical: {
    parse(input: string): QueryResult<QuerySpec>;
    stringify(spec: QuerySpec): QueryResult<string>;
  };
}

export interface SyntaxDialect {
  /** "jsonapi", "odata", "api-query-params", "page-pagination", … */
  readonly name: string;
  parse(ctx: DialectContext, input: string): QueryResult<QuerySpec>;
  /** Omitted ⇒ read-only dialect (accepts foreign input, emits canonical only). */
  stringify?(ctx: DialectContext, spec: QuerySpec): QueryResult<string>;
}

/*
 * Flagship dialect: page-based pagination (`page=2&limit=30`).
 *  - parse: requires limit, page ≥ 1; offset = (page - 1) * limit. The
 *    canonical spec NEVER contains a `page` field (ADR-0001 §4).
 *  - stringify: re-derives page only when offset % limit === 0; otherwise the
 *    spec is reported as not page-representable via a structured error.
 * In v0.1 (no dialects), `page=` fails canonical parsing with UNKNOWN_FIELD by
 * design — the error message points users to this dialect.
 *
 * v0.2 wiring (indicative):
 *   parseQuery(query, input, { dialect })
 *   stringifyQuery(query, spec, { dialect })
 */
