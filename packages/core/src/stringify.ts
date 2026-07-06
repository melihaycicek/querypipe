import { canonicalValueString } from "./convert";
import { encodeValue } from "./encode";
import { OPERATORS } from "./ops";
import { parseSpec } from "./parse";
import { ok, type QueryResult } from "./result";
import type { FilterCondition, QueryDef, QuerySpec } from "./types";

/**
 * Deterministic canonical serialization (ADR-0007 §4). Assumes a validated
 * spec (conditions only in v0.1): segment order sort,filter,offset,limit,
 * cursor,version; sorts by (priority, array index); filters in spec order;
 * six-character escape set, uppercase hex.
 */
export function stringifySpec(def: QueryDef, spec: QuerySpec): string {
  const segments: string[] = [];

  if (spec.sorts.length > 0) {
    const ordered = [...spec.sorts].sort((a, b) => a.priority - b.priority); // stable: ties keep array order
    segments.push(
      "sort=" +
        ordered
          .map((s) => {
            const item = wireName(def, s.field) + ":" + s.direction;
            return s.nulls === undefined ? item : item + ":nulls" + s.nulls;
          })
          .join(","),
    );
  }

  if (spec.filters.length > 0) {
    segments.push(
      "filter=" +
        spec.filters
          .map((node) => {
            const cond = node as FilterCondition; // v0.1: validated specs hold conditions only
            const head = wireName(def, cond.field) + ":" + cond.op;
            if (OPERATORS[cond.op].arity === "none") return head;
            const field = def.fields[cond.field] as QueryDef["fields"][string];
            const values: readonly unknown[] =
              OPERATORS[cond.op].arity === "one"
                ? [cond.value]
                : (cond.value as readonly unknown[]);
            return head + ":" + values.map((v) => encodeValue(canonicalValueString(field, v))).join(",");
          })
          .join(";"),
    );
  }

  if (spec.offset !== undefined) segments.push("offset=" + String(spec.offset));
  if (spec.limit !== undefined) segments.push("limit=" + String(spec.limit));
  if (spec.cursor !== undefined) segments.push("cursor=" + encodeValue(spec.cursor));
  if (spec.version !== undefined) segments.push("version=" + String(spec.version));

  return segments.join("&");
}

function wireName(def: QueryDef, name: string): string {
  const field = def.fields[name];
  return field?.alias ?? name;
}

/** stringify ∘ parse — the idempotent canonicalization (ADR-0007 §6, law 1b). */
export function canonicalizeInput(def: QueryDef, input: string): QueryResult<string> {
  const parsed = parseSpec(def, input);
  return parsed.ok ? ok(stringifySpec(def, parsed.value)) : parsed;
}
