import { canonicalValueString } from "./convert";
import { qerr } from "./errors";
import { OPERATORS, isOperator } from "./ops";
import type {
  FilterCondition,
  FilterGroup,
  FilterNode,
  GuardConfig,
  QueryDef,
  QueryError,
  QuerySpec,
  ResolvedGuards,
} from "./types";

export const DEFAULT_GUARDS: ResolvedGuards = {
  maxSortColumns: 3,
  maxFilters: 10,
  maxValueLength: 256,
  maxInItems: 100,
  maxLimit: Infinity, // opt-in (ADR-0012 §1)
  maxErrors: 50,
};

const GUARD_KEYS = Object.keys(DEFAULT_GUARDS) as ReadonlyArray<keyof ResolvedGuards>;

/** Merge with defaults; construction misuse throws (ADR-0003 §2). */
export function resolveGuards(config: GuardConfig | undefined): ResolvedGuards {
  const merged = { ...DEFAULT_GUARDS };
  if (config === undefined) return merged;
  if (config === null || typeof config !== "object") {
    throw new TypeError("guards must be an object");
  }
  for (const key of GUARD_KEYS) {
    const v = config[key];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1) {
      throw new TypeError(`guards.${key} must be a positive integer`);
    }
    merged[key] = v;
  }
  return merged;
}

/** Filter conditions are counted as leaves so the guard stays meaningful when groups unlock (ADR-0006 §1). */
function countLeaves(nodes: readonly unknown[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node !== null && typeof node === "object" && (node as FilterNode).kind === "group") {
      const children = (node as FilterGroup).children;
      count += Array.isArray(children) ? countLeaves(children) : 0;
    } else {
      count += 1;
    }
  }
  return count;
}

/**
 * Boundary guard enforcement (ADR-0006): structural limits + per-value length
 * (measured on the canonical string form, UTF-16 units). Positions are never
 * attached — guard errors are identical on the string and JSON paths.
 */
export function applyGuards(def: QueryDef, spec: QuerySpec): QueryError[] {
  const g = def.guards;
  const errors: QueryError[] = [];

  const sorts = Array.isArray(spec.sorts) ? spec.sorts : [];
  if (sorts.length > g.maxSortColumns) {
    errors.push(qerr("MAX_SORT_EXCEEDED", `${sorts.length} sort columns (max ${g.maxSortColumns})`));
  }

  const nodes = Array.isArray(spec.filters) ? spec.filters : [];
  const leafCount = countLeaves(nodes);
  if (leafCount > g.maxFilters) {
    errors.push(qerr("MAX_FILTER_EXCEEDED", `${leafCount} filters (max ${g.maxFilters})`));
  }
  for (const node of nodes) checkNodeValues(def, g, node, errors);

  if (typeof spec.cursor === "string" && spec.cursor.length > g.maxValueLength) {
    errors.push(qerr("VALUE_TOO_LONG", `cursor too long (max ${g.maxValueLength})`, { field: "cursor" }));
  }

  // Malformed limits (negative, fractional) are the validator's INVALID_VALUE; this is the size cap only.
  if (Number.isSafeInteger(spec.limit) && (spec.limit as number) > g.maxLimit) {
    errors.push(qerr("VALUE_TOO_LONG", `limit too large (max ${g.maxLimit})`, { field: "limit" }));
  }

  return errors;
}

/** Bound the error list: the first `maxErrors`, in input order (ADR-0012 §2). */
export function capErrors(def: QueryDef, errors: QueryError[]): QueryError[] {
  return errors.length > def.guards.maxErrors ? errors.slice(0, def.guards.maxErrors) : errors;
}

function checkNodeValues(def: QueryDef, g: ResolvedGuards, node: unknown, errors: QueryError[]): void {
  if (node === null || typeof node !== "object") return;
  const n = node as FilterNode;
  if (n.kind === "group") {
    const children = (n as FilterGroup).children;
    if (Array.isArray(children)) for (const child of children) checkNodeValues(def, g, child, errors);
    return;
  }
  if (n.kind !== "condition") return; // structural errors are the validator's job
  const cond = n as FilterCondition;
  const field = def.fields[cond.field];
  if (field === undefined || typeof cond.op !== "string" || !isOperator(cond.op)) return;
  const meta = OPERATORS[cond.op];
  if (meta.arity === "none") return;

  const values: readonly unknown[] =
    meta.arity === "one" ? [cond.value] : Array.isArray(cond.value) ? cond.value : [];

  const at = { field: cond.field, op: cond.op };
  if ((cond.op === "in" || cond.op === "notIn") && values.length > g.maxInItems) {
    // The list is the oversized value: VALUE_TOO_LONG with op set (ADR-0006 §2).
    errors.push(qerr("VALUE_TOO_LONG", `${values.length} items (maxInItems ${g.maxInItems})`, at));
    return;
  }

  for (const value of values) {
    if (canonicalValueString(field, value).length > g.maxValueLength) {
      errors.push(qerr("VALUE_TOO_LONG", `value too long (max ${g.maxValueLength})`, at));
    }
  }
}
