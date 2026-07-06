import { compileComparator } from "./comparator";
import { compileFilter } from "./predicate";
import type { QueryDef, QuerySpec } from "./types";

/**
 * Client-side execution of a validated, cursor-free spec: filter (root AND) →
 * stable sort with precompiled comparator + tie-breaker → offset/limit slice.
 * Non-mutating: the input array and its rows are never touched (`toSorted`
 * semantics via copy-then-sort).
 */
export function applySpecToRows<Row extends object>(
  def: QueryDef,
  spec: QuerySpec,
  rows: readonly Row[],
): Row[] {
  const predicate = compileFilter(def, spec.filters);
  const result: Row[] = predicate
    ? rows.filter((row) => predicate(row as Record<string, unknown>))
    : rows.slice();

  const comparator = compileComparator<Row>(def, spec.sorts);
  if (comparator !== null) result.sort(comparator); // fresh array; stable per ES2019

  const start = spec.offset ?? 0;
  if (start > 0 || spec.limit !== undefined) {
    return result.slice(start, spec.limit !== undefined ? start + spec.limit : undefined);
  }
  return result;
}
