import { applySpecToRows } from "./apply";
import { qerr } from "./errors";
import { parseSpec } from "./parse";
import { EMPTY_SPEC, QueryImpl, buildDef } from "./query";
import { err, ok, type QueryResult } from "./result";
import { canonicalizeInput, stringifySpec } from "./stringify";
import { validateSpecInternal } from "./validate";
import type { FieldMap, Query, QueryDefinition, QuerySpec } from "./types";

/**
 * Top-level API. The object returned by createQuery doubles as the schema
 * handle for every function here — there is deliberately no schema-less parse
 * (mandatory whitelist, ADR-0006). Data-path functions return Results and
 * never throw (ADR-0003); passing a non-query as the handle is construction
 * misuse and throws TypeError.
 */

export function createQuery<F extends FieldMap>(definition: QueryDefinition<F>): Query<F> {
  const def = buildDef(definition);
  return new QueryImpl(def, EMPTY_SPEC) as unknown as Query<F>;
}

function implOf(query: unknown): QueryImpl {
  if (!(query instanceof QueryImpl)) throw new TypeError("expected a createQuery() instance");
  return query;
}

export function parseQuery<F extends FieldMap>(
  query: Query<F>,
  input: string,
): QueryResult<QuerySpec> {
  return parseSpec(implOf(query).def, input);
}

export function stringifyQuery<F extends FieldMap>(
  query: Query<F>,
  spec?: QuerySpec,
): QueryResult<string> {
  const impl = implOf(query);
  if (spec === undefined) return ok(stringifySpec(impl.def, impl.spec)); // builder specs are valid by construction
  const errors = validateSpecInternal(impl.def, spec);
  return errors.length > 0 ? err(errors) : ok(stringifySpec(impl.def, spec));
}

export function validateQuerySpec<F extends FieldMap>(
  query: Query<F>,
  spec: QuerySpec,
): QueryResult<QuerySpec> {
  const errors = validateSpecInternal(implOf(query).def, spec);
  return errors.length > 0 ? err(errors) : ok(spec); // returns the input unchanged on ok
}

export function canonicalize<F extends FieldMap>(
  query: Query<F>,
  input: string,
): QueryResult<string> {
  return canonicalizeInput(implOf(query).def, input);
}

export function applyQuery<F extends FieldMap, Row extends object>(
  query: Query<F>,
  spec: QuerySpec,
  rows: readonly Row[],
): QueryResult<Row[]> {
  const impl = implOf(query);
  const errors = validateSpecInternal(impl.def, spec);
  if (errors.length > 0) return err(errors);
  if (spec.cursor !== undefined) {
    return err([
      qerr("INVALID_VALUE", "cursor is not executable client-side in v0.1", { field: "cursor" }),
    ]);
  }
  return ok(applySpecToRows(impl.def, spec, rows));
}
