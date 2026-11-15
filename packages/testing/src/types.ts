/**
 * Language-independent conformance seam (docs/spec/test-vectors.md).
 * Deliberately does NOT import querypipe: any implementation (the TS
 * core, querypipe-java, adapter engines) plugs in behind VectorEngine.
 */

export interface VectorFieldDef {
  readonly type: "number" | "string" | "date" | "boolean" | "enum";
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly alias?: string;
  readonly values?: readonly string[];
}

export interface VectorGuards {
  readonly maxSortColumns?: number;
  readonly maxFilters?: number;
  readonly maxValueLength?: number;
  readonly maxInItems?: number;
  readonly maxLimit?: number;
  readonly maxErrors?: number;
}

export interface VectorSchema {
  readonly stableBy?: string;
  readonly guards?: VectorGuards;
  readonly fields: Readonly<Record<string, VectorFieldDef>>;
}

export interface ErrorMatcher {
  readonly code: string;
  readonly field?: string;
  readonly op?: string;
  readonly position?: number;
}

export interface VectorExpect {
  readonly ok?: boolean;
  readonly spec?: unknown;
  readonly output?: string;
  readonly errors?: readonly ErrorMatcher[];
  readonly ids?: readonly unknown[];
  readonly rows?: readonly unknown[];
}

export type VectorOp = "parse" | "stringify" | "canonicalize" | "validate" | "apply" | "roundtrip-spec";

export interface VectorCase {
  readonly name: string;
  readonly op: VectorOp;
  readonly input?: string;
  readonly spec?: unknown;
  readonly rows?: readonly unknown[];
  readonly expect?: VectorExpect;
  /** Default true: actual error count must equal the matcher count. */
  readonly exactErrors?: boolean;
  readonly note?: string;
}

export interface VectorFile {
  readonly suite: string;
  readonly description: string;
  readonly specVersion: number;
  readonly schema: VectorSchema;
  readonly idField?: string;
  readonly cases: readonly VectorCase[];
}

export interface JsonError {
  readonly code: string;
  readonly field?: string;
  readonly op?: string;
  readonly message: string;
  readonly position?: number;
}

export type JsonResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly errors: readonly JsonError[] };

/** The five pure operations an implementation under test must expose. */
export interface VectorEngine {
  parse(schema: VectorSchema, input: string): JsonResult;
  stringify(schema: VectorSchema, spec: unknown): JsonResult;
  canonicalize(schema: VectorSchema, input: string): JsonResult;
  validate(schema: VectorSchema, spec: unknown): JsonResult;
  apply(schema: VectorSchema, spec: unknown, rows: readonly unknown[]): JsonResult;
}
