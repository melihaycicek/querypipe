import { createQuery, numberField, stringField } from "querypipe";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { coreEngine } from "../src/core-engine";
import {
  propApplyMatchesReferenceModel,
  propApplyNonMutating,
  propApplyStable,
  propConflictingPagination,
  propEscapingRoundtrip,
  propGuardsNeverThrow,
  propIdempotentCanonicalization,
  propRoundtripSpec,
  propTieBreakerIdempotent,
} from "../src/properties";

const RUNS = { numRuns: 250 };

describe("conformance laws (property-based, engine seam)", () => {
  it("law 1a — parse(stringify(spec)) identity for canonical specs", () => {
    fc.assert(propRoundtripSpec(coreEngine), RUNS);
  });

  it("law 1b — canonicalization is idempotent over accepted inputs", () => {
    fc.assert(propIdempotentCanonicalization(coreEngine), RUNS);
  });

  it("law 2 — apply is non-mutating and stable", () => {
    fc.assert(propApplyNonMutating(coreEngine), RUNS);
    fc.assert(propApplyStable(coreEngine), RUNS);
  });

  it("law 3 — apply ordering matches the SQL ORDER BY reference model", () => {
    fc.assert(propApplyMatchesReferenceModel(coreEngine), RUNS);
  });

  it("law 5 — guard breaches return codes, never throw", () => {
    fc.assert(propGuardsNeverThrow(coreEngine), { numRuns: 50 });
  });

  it("law 6 — tie-breaker injection is idempotent", () => {
    fc.assert(propTieBreakerIdempotent(coreEngine), RUNS);
  });

  it("law 7 — escaping round-trips structural characters losslessly", () => {
    fc.assert(propEscapingRoundtrip(coreEngine), { numRuns: 500 });
  });

  it("law 8 — cursor + offset is CONFLICTING_PAGINATION on both paths", () => {
    fc.assert(propConflictingPagination(coreEngine), { numRuns: 100 });
  });
});

describe("law 4 — thenSort never disturbs the existing chain (builder-specific)", () => {
  const FIELDS = ["a", "b", "c", "d", "e"] as const;
  const query = createQuery({
    fields: {
      id: numberField(),
      a: numberField(),
      b: numberField(),
      c: numberField(),
      d: stringField(),
      e: stringField(),
    },
    stableBy: "id",
    guards: { maxSortColumns: 10 },
  });

  it("appending a new field preserves every existing (field, direction, priority) triple", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...FIELDS), { minLength: 0, maxLength: 4 }),
        fc.array(fc.constantFrom<"asc" | "desc">("asc", "desc"), { minLength: 5, maxLength: 5 }),
        (chainFields, directions) => {
          let q = query;
          chainFields.forEach((field, i) => {
            q = q.thenSort(field, directions[i]);
          });
          const before = q.toSpec().sorts;
          const remaining = FIELDS.find((f) => !chainFields.includes(f)) as "a";
          const after = q.thenSort(remaining, directions[4]).toSpec().sorts;
          expect(after.slice(0, before.length)).toEqual(before);
          expect(after[after.length - 1]).toEqual({
            field: remaining,
            direction: directions[4],
            priority: before.length + 1,
          });
        },
      ),
      { numRuns: 200 },
    );
  });
});
