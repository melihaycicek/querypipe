import {
  applyQuery,
  booleanField,
  canonicalize,
  createQuery,
  dateField,
  enumField,
  numberField,
  parseQuery,
  stringField,
  stringifyQuery,
  validateQuerySpec,
} from "querypipe";
import type { QuerySpec } from "querypipe";
import type { JsonResult, VectorEngine, VectorFieldDef, VectorSchema } from "./types";

/**
 * VectorEngine adapter for querypipe — the seam querypipe-java re-implements
 * to run the same vector files (ADR-0011 §7).
 */

type AnyQuery = ReturnType<typeof createQuery>;

const cache = new WeakMap<VectorSchema, AnyQuery>();

function fieldFromDef(def: VectorFieldDef): unknown {
  const options = {
    ...(def.sortable === false ? { sortable: false } : {}),
    ...(def.filterable === false ? { filterable: false } : {}),
    ...(def.alias !== undefined ? { alias: def.alias } : {}),
  };
  switch (def.type) {
    case "number":
      return numberField(options);
    case "string":
      return stringField(options);
    case "date":
      return dateField(options);
    case "boolean":
      return booleanField(options);
    case "enum":
      return enumField(def.values as unknown as [string, ...string[]], options);
  }
}

export function buildCoreQuery(schema: VectorSchema): AnyQuery {
  const cached = cache.get(schema);
  if (cached !== undefined) return cached;
  const fields: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(schema.fields)) {
    fields[name] = fieldFromDef(def);
  }
  const definition = {
    fields,
    ...(schema.stableBy !== undefined ? { stableBy: schema.stableBy } : {}),
    ...(schema.guards !== undefined ? { guards: schema.guards } : {}),
  };
  // Vector schemas are runtime data — createQuery validates them; the generic
  // schema-shape inference is bypassed on purpose.
  const query = createQuery(definition as never) as unknown as AnyQuery;
  cache.set(schema, query);
  return query;
}

function toJson(result: { ok: true; value: unknown } | { ok: false; errors: readonly unknown[] }): JsonResult {
  if (result.ok) {
    return {
      ok: true,
      value: result.value === undefined ? undefined : JSON.parse(JSON.stringify(result.value)),
    };
  }
  return { ok: false, errors: JSON.parse(JSON.stringify(result.errors)) };
}

export const coreEngine: VectorEngine = {
  parse: (schema, input) => toJson(parseQuery(buildCoreQuery(schema), input)),
  stringify: (schema, spec) => toJson(stringifyQuery(buildCoreQuery(schema), spec as QuerySpec)),
  canonicalize: (schema, input) => toJson(canonicalize(buildCoreQuery(schema), input)),
  validate: (schema, spec) => toJson(validateQuerySpec(buildCoreQuery(schema), spec as QuerySpec)),
  apply: (schema, spec, rows) =>
    toJson(applyQuery(buildCoreQuery(schema), spec as QuerySpec, rows as readonly object[])),
};
