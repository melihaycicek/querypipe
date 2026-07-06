import { makeBaseCompare, makeNormalizer } from "./comparator";
import type { FilterCondition, FilterNode, InternalField, QueryDef } from "./types";

/**
 * Precompiled root-AND filter predicate over the same value model as the
 * comparator. SQL three-valued logic collapsed to "no match": NULL-class row
 * values never satisfy valued operators, `neq` and `notIn` included
 * (ADR-0008 §6). String operators are literal — no RegExp is ever built from
 * user input (ADR-0006 §4).
 */

type Row = Record<string, unknown>;

export function compileFilter(
  def: QueryDef,
  nodes: readonly FilterNode[],
): ((row: Row) => boolean) | null {
  if (nodes.length === 0) return null;
  // v0.1: validated specs contain conditions only (ADR-0001 §3).
  const tests = nodes.map((node) => compileCondition(def, node as FilterCondition));
  if (tests.length === 1) return tests[0] as (row: Row) => boolean;
  return (row) => {
    for (const test of tests) if (!test(row)) return false;
    return true;
  };
}

function compileCondition(def: QueryDef, cond: FilterCondition): (row: Row) => boolean {
  const field = def.fields[cond.field] as InternalField;
  const name = cond.field;

  switch (cond.op) {
    case "isNull":
      // Stricter than the sort NULL class on purpose: only null/missing (ADR-0008 §2).
      return (row) => row[name] === null || row[name] === undefined;
    case "notNull":
      return (row) => row[name] !== null && row[name] !== undefined;
    case "contains": {
      const needle = cond.value as string;
      return (row) => typeof row[name] === "string" && (row[name] as string).includes(needle);
    }
    case "startsWith": {
      const needle = cond.value as string;
      return (row) => typeof row[name] === "string" && (row[name] as string).startsWith(needle);
    }
    case "endsWith": {
      const needle = cond.value as string;
      return (row) => typeof row[name] === "string" && (row[name] as string).endsWith(needle);
    }
    default:
      break;
  }

  const normalize = makeNormalizer(field);
  const compare = makeBaseCompare(field);

  switch (cond.op) {
    case "eq": {
      const target = normalize(cond.value);
      if (target === null) return () => false;
      return (row) => {
        const v = normalize(row[name]);
        return v !== null && compare(v, target) === 0;
      };
    }
    case "neq": {
      const target = normalize(cond.value);
      if (target === null) return () => false;
      return (row) => {
        const v = normalize(row[name]);
        return v !== null && compare(v, target) !== 0;
      };
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const target = normalize(cond.value);
      if (target === null) return () => false;
      // sign expectations per operator: [allow r<0, allow r=0, allow r>0]
      const allow =
        cond.op === "gt" ? [0, 0, 1] : cond.op === "gte" ? [0, 1, 1] : cond.op === "lt" ? [1, 0, 0] : [1, 1, 0];
      return (row) => {
        const v = normalize(row[name]);
        if (v === null) return false;
        const r = compare(v, target);
        return allow[r < 0 ? 0 : r === 0 ? 1 : 2] === 1;
      };
    }
    case "between": {
      const pair = cond.value as readonly [unknown, unknown];
      const lo = normalize(pair[0]);
      const hi = normalize(pair[1]);
      if (lo === null || hi === null) return () => false;
      // Inclusive on both ends; reversed bounds match nothing (SQL parity).
      return (row) => {
        const v = normalize(row[name]);
        return v !== null && compare(v, lo) >= 0 && compare(v, hi) <= 0;
      };
    }
    case "in":
    case "notIn": {
      const targets = (cond.value as readonly unknown[])
        .map((v) => normalize(v))
        .filter((v) => v !== null);
      const negate = cond.op === "notIn";
      return (row) => {
        const v = normalize(row[name]);
        if (v === null) return false;
        const hit = targets.some((t) => compare(v, t) === 0);
        return negate ? !hit : hit;
      };
    }
    default:
      // Exhaustiveness backstop; unreachable on validated specs.
      return () => false;
  }
}
