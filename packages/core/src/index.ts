/**
 * querypipe — public surface (frozen contract: docs/api/public-api.d.ts).
 * Exactly 14 runtime exports and 10 type exports; internal types and helpers
 * are reachable through inference only.
 */

export {
  createQuery,
  parseQuery,
  stringifyQuery,
  validateQuerySpec,
  canonicalize,
  applyQuery,
} from "./api";

export {
  numberField,
  stringField,
  dateField,
  booleanField,
  enumField,
  customField,
} from "./fields";

export { isOk, isErr } from "./result";

export type { QueryResult } from "./result";
export type {
  QuerySpec,
  SortCondition,
  FilterNode,
  FilterCondition,
  FilterGroup,
  Operator,
  QueryError,
  QueryErrorCode,
  FieldSchema,
} from "./types";
