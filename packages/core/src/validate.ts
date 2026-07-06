import { checkJsonValue, runStandardSchema } from "./convert";
import { qerr } from "./errors";
import { applyGuards } from "./guards";
import { OPERATORS, isOperator, isStringOp } from "./ops";
import type { FilterCondition, QueryDef, QueryError, QuerySpec, SortCondition } from "./types";

/**
 * Full semantic validation of an externally produced spec against schema +
 * guards (ADR-0003). Collects every independent error; never throws; never
 * rewrites the spec. Error codes are pinned by vectors 04/06/20; message text
 * is non-normative and kept terse.
 */

const MSG_UINT = "non-negative integer required";

export function validateSpecInternal(def: QueryDef, spec: QuerySpec): QueryError[] {
  if (spec === null || typeof spec !== "object") {
    return [qerr("INVALID_VALUE", "spec must be an object")];
  }
  const errors: QueryError[] = [];

  const filters = (spec as { filters?: unknown }).filters;
  if (!Array.isArray(filters)) {
    errors.push(qerr("INVALID_VALUE", "filters must be an array"));
  } else {
    for (const node of filters) validateNode(def, node, errors);
  }

  const sorts = (spec as { sorts?: unknown }).sorts;
  if (!Array.isArray(sorts)) {
    errors.push(qerr("INVALID_VALUE", "sorts must be an array"));
  } else {
    const seen = new Set<string>();
    for (const sort of sorts) validateSort(def, sort, seen, errors);
  }

  validatePagination(spec, errors);
  errors.push(...applyGuards(def, spec));
  return errors;
}

function validateNode(def: QueryDef, node: unknown, errors: QueryError[]): void {
  const bad = (message: string, at?: { field?: string; op?: string }) => {
    errors.push(qerr("INVALID_VALUE", message, at));
  };
  if (node === null || typeof node !== "object") {
    bad("invalid filter node");
    return;
  }
  const kind = (node as { kind?: unknown }).kind;
  if (kind === "group") {
    bad("kind:'group' is reserved (v0.3); v0.1 accepts kind:'condition' only");
    return;
  }
  if (kind !== "condition") {
    bad("missing kind discriminator");
    return;
  }

  const cond = node as FilterCondition;
  if (typeof cond.field !== "string") {
    bad("field must be a string");
    return;
  }
  const field = def.fields[cond.field];
  if (field === undefined) {
    errors.push(qerr("UNKNOWN_FIELD", "unknown field", { field: cond.field }));
    return;
  }
  if (!field.filterable) {
    errors.push(qerr("NOT_FILTERABLE", "not filterable", { field: cond.field }));
    return;
  }
  if (typeof cond.op !== "string" || !isOperator(cond.op)) {
    errors.push(qerr("INVALID_OPERATOR", "unknown operator", { field: cond.field, op: String(cond.op) }));
    return;
  }
  const meta = OPERATORS[cond.op];
  const at = { field: cond.field, op: cond.op };
  if (!meta.kinds.includes(field.type)) {
    errors.push(qerr("INVALID_OPERATOR", `not applicable to ${field.type} field`, at));
    return;
  }

  if (meta.arity === "none") {
    if ("value" in cond && cond.value !== undefined) bad("takes no value", at);
    return;
  }

  if (meta.arity === "one") {
    if (cond.value === undefined) {
      bad("missing value", at);
      return;
    }
    checkValue(field, cond.value, at, errors);
    return;
  }

  if (meta.arity === "two") {
    if (!Array.isArray(cond.value) || cond.value.length !== 2) {
      bad("expects [min, max]", at);
      return;
    }
    for (const v of cond.value) checkValue(field, v, at, errors);
    return;
  }

  // many
  if (!Array.isArray(cond.value) || cond.value.length === 0) {
    bad("expects a non-empty array", at);
    return;
  }
  for (const v of cond.value) checkValue(field, v, at, errors);
}

function checkValue(
  field: QueryDef["fields"][string],
  value: unknown,
  at: { field: string; op: string },
  errors: QueryError[],
): void {
  // String-operator values are plain fragments, independent of the field kind.
  if (isStringOp(at.op)) {
    if (typeof value !== "string") {
      errors.push(qerr("INVALID_VALUE", "expects a string fragment", at));
    }
    return;
  }
  const converted = checkJsonValue(field, value);
  if (!converted.ok) {
    errors.push(qerr("INVALID_VALUE", converted.reason, at));
    return;
  }
  if (field.schema) {
    // Acceptance check only — validateQuerySpec never rewrites values (ADR-0009 §2).
    const run = runStandardSchema(field.schema, converted.value);
    if (!run.ok) errors.push(qerr("INVALID_VALUE", run.reason, at));
  }
}

function validateSort(def: QueryDef, sort: unknown, seen: Set<string>, errors: QueryError[]): void {
  if (sort === null || typeof sort !== "object") {
    errors.push(qerr("INVALID_VALUE", "invalid sort node"));
    return;
  }
  const s = sort as SortCondition;
  if (typeof s.field !== "string") {
    errors.push(qerr("INVALID_VALUE", "field must be a string"));
    return;
  }
  const bad = (message: string) => {
    errors.push(qerr("INVALID_VALUE", message, { field: s.field }));
  };
  const field = def.fields[s.field];
  if (field === undefined) {
    errors.push(qerr("UNKNOWN_FIELD", "unknown field", { field: s.field }));
    return;
  }
  if (!field.sortable) {
    errors.push(qerr("NOT_SORTABLE", "not sortable", { field: s.field }));
    return;
  }
  if (s.direction !== "asc" && s.direction !== "desc") {
    bad("invalid direction");
    return;
  }
  if ("nulls" in s && s.nulls !== undefined && s.nulls !== "first" && s.nulls !== "last") {
    bad("invalid nulls");
    return;
  }
  if (typeof s.priority !== "number" || !Number.isInteger(s.priority) || s.priority < 1) {
    bad("priority must be an integer >= 1");
    return;
  }
  if (seen.has(s.field)) {
    bad("duplicate sort field");
    return;
  }
  seen.add(s.field);
}

function validatePagination(spec: QuerySpec, errors: QueryError[]): void {
  const bad = (message: string, field: string) => {
    errors.push(qerr("INVALID_VALUE", message, { field }));
  };
  if (spec.limit !== undefined && !isPageInt(spec.limit)) bad(MSG_UINT, "limit");
  if (spec.offset !== undefined && !isPageInt(spec.offset)) bad(MSG_UINT, "offset");
  if (spec.cursor !== undefined && (typeof spec.cursor !== "string" || spec.cursor.length === 0)) {
    bad("non-empty string required", "cursor");
  }
  if (spec.version !== undefined && spec.version !== 1) {
    bad("unsupported version (expected 1)", "version");
  }
  if (spec.offset !== undefined && spec.cursor !== undefined) {
    errors.push(qerr("CONFLICTING_PAGINATION", "offset and cursor are mutually exclusive"));
  }
}

function isPageInt(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
