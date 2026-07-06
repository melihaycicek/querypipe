import type { VectorFieldDef, VectorSchema } from "./types";

/**
 * Independent pure-function model of SQL ORDER BY semantics per ADR-0008,
 * written directly from the spec text and deliberately NOT sharing code with
 * querypipe — the property suite cross-checks core's apply against it
 * (conformance property #3). Stability is by construction (index decoration),
 * not by relying on the host sort's stability.
 */

export interface ReferenceSort {
  readonly field: string;
  readonly direction: "asc" | "desc";
  readonly nulls?: "first" | "last";
  readonly priority: number;
}

type RefRow = Record<string, unknown>;

/** Row value → comparable (number | string) or null for the NULL class (ADR-0008 §2). */
function normalize(field: VectorFieldDef, value: unknown): number | string | null {
  switch (field.type) {
    case "number":
      return typeof value === "number" && !Number.isNaN(value) ? value : null;
    case "string":
      return typeof value === "string" ? value : null;
    case "boolean":
      return typeof value === "boolean" ? (value ? 1 : 0) : null;
    case "date": {
      if (typeof value === "string") {
        const t = Date.parse(value);
        return Number.isNaN(t) ? null : t;
      }
      if (typeof value === "number") return Number.isNaN(value) ? null : value;
      return null;
    }
    case "enum": {
      if (typeof value !== "string") return null;
      const idx = (field.values ?? []).indexOf(value);
      return idx < 0 ? null : idx;
    }
  }
}

function compareColumn(schema: VectorSchema, sort: ReferenceSort, a: RefRow, b: RefRow): number {
  const field = schema.fields[sort.field];
  if (field === undefined) return 0;
  const va = normalize(field, a[sort.field]);
  const vb = normalize(field, b[sort.field]);
  const aNull = va === null;
  const bNull = vb === null;
  if (aNull || bNull) {
    if (aNull && bNull) return 0;
    if (sort.nulls !== undefined) return (aNull ? -1 : 1) * (sort.nulls === "first" ? 1 : -1);
    const r = aNull ? 1 : -1; // NULL is larger than every non-null value
    return sort.direction === "desc" ? -r : r;
  }
  let base: number;
  if (typeof va === "string") {
    const s = vb as string;
    base = va < s ? -1 : va > s ? 1 : 0; // UTF-16 code-unit order
  } else {
    const n = vb as number;
    base = va < n ? -1 : va > n ? 1 : 0;
  }
  return sort.direction === "desc" ? -base : base;
}

export function referenceSort<Row extends RefRow>(
  schema: VectorSchema,
  sorts: readonly ReferenceSort[],
  rows: readonly Row[],
): Row[] {
  if (sorts.length === 0) return [...rows]; // no sort, no tie-breaker injection (ADR-0005 §4)
  const chain: ReferenceSort[] = [...sorts].sort((a, b) => a.priority - b.priority);
  const stableBy = schema.stableBy;
  if (stableBy !== undefined && !chain.some((s) => s.field === stableBy)) {
    chain.push({ field: stableBy, direction: "asc", priority: chain.length + 1 });
  }
  const decorated = rows.map((row, index) => ({ row, index }));
  decorated.sort((a, b) => {
    for (const sort of chain) {
      const r = compareColumn(schema, sort, a.row, b.row);
      if (r !== 0) return r;
    }
    return a.index - b.index; // ties keep input order, by construction
  });
  return decorated.map((d) => d.row);
}
