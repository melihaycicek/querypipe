import fc from "fast-check";
import {
  PROPERTY_SCHEMA,
  arbCanonicalSpec,
  arbRows,
  arbSorts,
  arbStringValue,
  type ArbSort,
} from "./arbitraries";
import { deepEqual, jsonNormalize } from "./deep-equal";
import { referenceSort, type ReferenceSort } from "./reference-model";
import type { JsonResult, VectorEngine } from "./types";

/**
 * Engine-generic property-based invariants (conformance laws 1a/1b, 2, 3, 5,
 * 6, 7, 8 — docs/spec/test-vectors.md). Law 4 (thenSort prefix preservation)
 * is builder-specific and lives with the TS core's own property tests.
 */

function assertOk(result: JsonResult, what: string): unknown {
  if (!result.ok) throw new Error(`${what} failed: ${JSON.stringify(result.errors)}`);
  return result.value;
}

/** Law 1a: parse(stringify(spec)) deep-equals every canonical spec. */
export function propRoundtripSpec(engine: VectorEngine) {
  return fc.property(arbCanonicalSpec(), (spec) => {
    const s = assertOk(engine.stringify(PROPERTY_SCHEMA, spec), "stringify") as string;
    const parsed = assertOk(engine.parse(PROPERTY_SCHEMA, s), `parse of ${JSON.stringify(s)}`);
    return deepEqual(jsonNormalize(parsed), jsonNormalize(spec));
  });
}

/** Semantics-preserving messification: shuffle segments, drop redundant :asc. */
function messify(canonical: string, seeds: readonly number[]): string {
  if (canonical === "") return canonical;
  const segments = canonical.split("&");
  for (const seed of seeds) {
    const i = seed % segments.length;
    const j = (seed * 7 + 3) % segments.length;
    const tmp = segments[i] as string;
    segments[i] = segments[j] as string;
    segments[j] = tmp;
  }
  const dropAsc = (seeds[0] ?? 0) % 2 === 1;
  return segments
    .map((segment) =>
      dropAsc && segment.startsWith("sort=")
        ? segment.replace(/:asc(?=,|$)/g, "") // never touches :asc:nulls… thanks to the lookahead
        : segment,
    )
    .join("&");
}

/** Law 1b: canonicalize is idempotent over accepted inputs (and converges to the canonical form). */
export function propIdempotentCanonicalization(
  engine: VectorEngine,
) {
  return fc.property(arbCanonicalSpec(), fc.array(fc.nat({ max: 100 }), { maxLength: 8 }), (spec, seeds) => {
    const canonical = assertOk(engine.stringify(PROPERTY_SCHEMA, spec), "stringify") as string;
    const messy = messify(canonical, seeds);
    const once = assertOk(engine.canonicalize(PROPERTY_SCHEMA, messy), `canonicalize of ${JSON.stringify(messy)}`) as string;
    const twice = assertOk(engine.canonicalize(PROPERTY_SCHEMA, once), "re-canonicalize") as string;
    return once === canonical && twice === once;
  });
}

/** Law 2a: apply never mutates its input rows. */
export function propApplyNonMutating(
  engine: VectorEngine,
) {
  return fc.property(arbCanonicalSpec(), arbRows, (spec, rows) => {
    if ((spec as { cursor?: unknown }).cursor !== undefined) return true; // cursor specs are rejected by apply
    const snapshot = jsonNormalize(rows);
    engine.apply(PROPERTY_SCHEMA, spec, rows);
    return deepEqual(jsonNormalize(rows), snapshot);
  });
}

/** Law 2b: apply is stable — full-tie sorts preserve input order. */
export function propApplyStable(engine: VectorEngine) {
  return fc.property(fc.nat({ max: 25 }), fc.constantFrom("asc", "desc"), (n, direction) => {
    // No id / constant key: every comparison ties, including the tie-breaker column.
    const rows = Array.from({ length: n }, (_, i) => ({ price: 1, tag: i }));
    const applied = assertOk(
      engine.apply(PROPERTY_SCHEMA, { filters: [], sorts: [{ field: "price", direction, priority: 1 }] }, rows),
      "apply",
    ) as Array<{ tag: number }>;
    return deepEqual(applied.map((r) => r.tag), rows.map((r) => r.tag));
  });
}

/** Law 3: apply ordering ≡ the independent SQL ORDER BY reference model. */
export function propApplyMatchesReferenceModel(
  engine: VectorEngine,
) {
  return fc.property(arbSorts(), arbRows, (sorts, rows) => {
    const tagged = rows.map((row, i) => ({ ...row, tag: i }));
    const applied = assertOk(
      engine.apply(PROPERTY_SCHEMA, { filters: [], sorts }, tagged),
      "apply",
    ) as Array<{ tag: number }>;
    const expected = referenceSort(PROPERTY_SCHEMA, sorts as ReferenceSort[], tagged);
    return deepEqual(applied.map((r) => r.tag), expected.map((r) => r.tag));
  });
}

/** Law 5: guard breaches return the right code and never throw. */
export function propGuardsNeverThrow(engine: VectorEngine) {
  return fc.property(fc.integer({ min: 4, max: 7 }), fc.integer({ min: 11, max: 20 }), (sortCount, filterCount) => {
    const sortInput =
      "sort=" +
      ["id", "price", "stock", "name", "category", "active", "createdAt"]
        .slice(0, sortCount)
        .map((f) => (f === "createdAt" ? "created" : f) + ":asc")
        .join(",");
    const filterInput =
      "filter=" + Array.from({ length: filterCount }, (_, i) => `price:gt:${i}`).join(";");
    const longValue = "filter=name:eq:" + "a".repeat(300);

    const sorted = engine.parse(PROPERTY_SCHEMA, sortInput);
    const filtered = engine.parse(PROPERTY_SCHEMA, filterInput);
    const oversized = engine.parse(PROPERTY_SCHEMA, longValue);
    return (
      !sorted.ok &&
      sorted.errors.some((e) => e.code === "MAX_SORT_EXCEEDED") &&
      !filtered.ok &&
      filtered.errors.some((e) => e.code === "MAX_FILTER_EXCEEDED") &&
      !oversized.ok &&
      oversized.errors.some((e) => e.code === "VALUE_TOO_LONG")
    );
  });
}

/** Law 6: tie-breaker injection ≡ spelling the tie-breaker out explicitly. */
export function propTieBreakerIdempotent(
  engine: VectorEngine,
) {
  // maxLength 2 leaves headroom for the explicit tie-breaker under maxSortColumns 3.
  return fc.property(arbSorts({ minLength: 1, maxLength: 2, exclude: ["id"] }), arbRows, (sorts, rows) => {
    const tagged = rows.map((row, i) => ({ ...row, tag: i }));
    const explicit = [...sorts, { field: "id", direction: "asc" as const, priority: sorts.length + 1 }];
    const implicitly = assertOk(
      engine.apply(PROPERTY_SCHEMA, { filters: [], sorts }, tagged),
      "apply",
    ) as Array<{ tag: number }>;
    const explicitly = assertOk(
      engine.apply(PROPERTY_SCHEMA, { filters: [], sorts: explicit }, tagged),
      "apply",
    ) as Array<{ tag: number }>;
    return deepEqual(implicitly.map((r) => r.tag), explicitly.map((r) => r.tag));
  });
}

/** Law 7: values containing structural characters round-trip losslessly. */
export function propEscapingRoundtrip(engine: VectorEngine) {
  return fc.property(arbStringValue, (value) => {
    const spec = { filters: [{ kind: "condition", field: "name", op: "eq", value }], sorts: [] };
    const s = assertOk(engine.stringify(PROPERTY_SCHEMA, spec), "stringify") as string;
    const parsed = assertOk(engine.parse(PROPERTY_SCHEMA, s), `parse of ${JSON.stringify(s)}`) as {
      filters: Array<{ value?: unknown }>;
    };
    return parsed.filters[0]?.value === value;
  });
}

/** Law 8: cursor + offset ⇒ CONFLICTING_PAGINATION on both ingress paths. */
export function propConflictingPagination(engine: VectorEngine) {
  return fc.property(fc.nat({ max: 1000 }), fc.hexaString({ minLength: 1, maxLength: 12 }), (offset, cursor) => {
    const viaJson = engine.validate(PROPERTY_SCHEMA, { filters: [], sorts: [], offset, cursor });
    const viaString = engine.parse(PROPERTY_SCHEMA, `offset=${offset}&cursor=${cursor}`);
    return (
      !viaJson.ok &&
      viaJson.errors.some((e) => e.code === "CONFLICTING_PAGINATION") &&
      !viaString.ok &&
      viaString.errors.some((e) => e.code === "CONFLICTING_PAGINATION")
    );
  });
}
