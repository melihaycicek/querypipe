import type { FilterCondition, QuerySpec } from "./types";

/**
 * Deep-freeze a spec the library constructed (ADR-0002 §1). Never applied to
 * caller-owned specs — validateQuerySpec returns its input untouched.
 */
export function deepFreezeSpec(spec: QuerySpec): QuerySpec {
  for (const node of spec.filters) {
    const value = (node as FilterCondition).value;
    if (Array.isArray(value)) Object.freeze(value);
    Object.freeze(node);
  }
  Object.freeze(spec.filters);
  for (const sort of spec.sorts) Object.freeze(sort);
  Object.freeze(spec.sorts);
  return Object.freeze(spec);
}
