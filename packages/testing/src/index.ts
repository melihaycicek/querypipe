/**
 * @querypipe/testing — language-independent conformance vectors, the vector
 * runner seam, an independent ORDER BY reference model and fast-check
 * invariant properties. querypipe-java implements VectorEngine and runs the
 * identical files in ./vectors (ADR-0011 §7).
 */

export type {
  ErrorMatcher,
  JsonError,
  JsonResult,
  VectorCase,
  VectorEngine,
  VectorExpect,
  VectorFieldDef,
  VectorFile,
  VectorGuards,
  VectorOp,
  VectorSchema,
} from "./types";

export { defaultVectorsDir, loadVectorFiles } from "./loader";
export { deepEqual, jsonNormalize } from "./deep-equal";
export { runVectorCase, type CaseResult } from "./runner";
export { referenceSort, type ReferenceSort } from "./reference-model";

export {
  PROPERTY_SCHEMA,
  FIELD_NAMES,
  arbCanonicalSpec,
  arbCondition,
  arbNumberValue,
  arbRow,
  arbRows,
  arbSorts,
  arbStringValue,
  type ArbSort,
  type PropertyField,
} from "./arbitraries";

export {
  propApplyMatchesReferenceModel,
  propApplyNonMutating,
  propApplyStable,
  propConflictingPagination,
  propEscapingRoundtrip,
  propGuardsNeverThrow,
  propIdempotentCanonicalization,
  propRoundtripSpec,
  propTieBreakerIdempotent,
} from "./properties";

export { buildCoreQuery, coreEngine } from "./core-engine";
