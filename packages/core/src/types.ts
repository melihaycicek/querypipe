/**
 * Wire types (public) + schema/builder types (public-by-inference) + internal
 * runtime shapes. Only the types re-exported from index.ts are public API;
 * everything else here is reachable through inference only (frozen contract:
 * docs/api/public-api.d.ts).
 */

/* ------------------------------------------------------------------ *
 * Wire types (ADR-0001, ADR-0011)
 * ------------------------------------------------------------------ */

export type Operator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "notIn"
  | "between"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "isNull"
  | "notNull";

export interface FilterCondition {
  readonly kind: "condition";
  readonly field: string;
  readonly op: Operator;
  readonly value?: unknown;
}

export interface FilterGroup {
  readonly kind: "group";
  readonly logic: "and" | "or";
  readonly children: readonly FilterNode[];
}

export type FilterNode = FilterCondition | FilterGroup;

export interface SortCondition {
  readonly field: string;
  readonly direction: "asc" | "desc";
  readonly nulls?: "first" | "last";
  readonly priority: number;
}

export interface QuerySpec {
  readonly filters: readonly FilterNode[];
  readonly sorts: readonly SortCondition[];
  readonly limit?: number;
  readonly offset?: number;
  readonly cursor?: string;
  readonly version?: number;
}

export type QueryErrorCode =
  | "UNKNOWN_FIELD"
  | "NOT_SORTABLE"
  | "NOT_FILTERABLE"
  | "INVALID_OPERATOR"
  | "INVALID_VALUE"
  | "MAX_SORT_EXCEEDED"
  | "MAX_FILTER_EXCEEDED"
  | "VALUE_TOO_LONG"
  | "CONFLICTING_PAGINATION";

export interface QueryError {
  readonly code: QueryErrorCode;
  readonly field?: string;
  readonly op?: string;
  readonly message: string;
  readonly position?: number;
}

/* ------------------------------------------------------------------ *
 * Standard Schema (vendored type-only subset; ADR-0009)
 * ------------------------------------------------------------------ */

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
}

export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<{ readonly message: string }> };

/* ------------------------------------------------------------------ *
 * Field schema DSL types
 * ------------------------------------------------------------------ */

export type FieldKind = "number" | "string" | "date" | "boolean" | "enum" | "custom";

export interface FieldSchema<
  T = unknown,
  TSortable extends boolean = boolean,
  TFilterable extends boolean = boolean,
  TKind extends FieldKind = FieldKind,
> {
  readonly type: TKind;
  readonly sortable: TSortable;
  readonly filterable: TFilterable;
  /** Wire name for the canonical string format (ADR-0007 §7). */
  readonly alias?: string;
  /** Type-level value carrier; never present at runtime. */
  readonly "~value"?: T;
}

export interface BaseFieldOptions {
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly alias?: string;
}

export interface NumberFieldOptions extends BaseFieldOptions {
  readonly schema?: StandardSchemaV1<unknown, number>;
}

export interface StringFieldOptions extends BaseFieldOptions {
  /** Opt-in Intl.Collator ordering. Default: UTF-16 code-unit order (ADR-0008). */
  readonly locale?: string;
  readonly sensitivity?: "base" | "accent" | "case" | "variant";
  readonly schema?: StandardSchemaV1<unknown, string>;
}

export interface DateFieldOptions extends BaseFieldOptions {
  readonly schema?: StandardSchemaV1<unknown, string>;
}

export interface BooleanFieldOptions extends BaseFieldOptions {
  readonly schema?: StandardSchemaV1<unknown, boolean>;
}

export interface EnumFieldOptions extends BaseFieldOptions {
  readonly schema?: StandardSchemaV1<unknown, string>;
}

export interface CustomFieldOptions<T> extends BaseFieldOptions {
  /** Sort basis. Never receives NULL-class values (ADR-0008 §3). */
  readonly comparator: (a: T, b: T) => number;
  readonly schema?: StandardSchemaV1<unknown, T>;
}

/** `{ sortable: false }` narrows to `false`; anything else resolves `true`. */
export type ResolvedFlag<O, K extends keyof BaseFieldOptions> =
  O extends Record<K, false> ? false : true;

/** Filter/sort input type for date fields; normalized to an ISO string in the spec (ADR-0011 §3). */
export type DateInput = Date | string | number;

/* ------------------------------------------------------------------ *
 * Schema-bound builder types
 * ------------------------------------------------------------------ */

export type AnyFieldSchema = FieldSchema<any, boolean, boolean, FieldKind>;
export type FieldMap = Record<string, AnyFieldSchema>;

export type FieldValue<F extends FieldMap, K extends keyof F> =
  F[K] extends FieldSchema<infer T, boolean, boolean, FieldKind> ? T : never;

export type SortableField<F extends FieldMap> = {
  [K in keyof F & string]: F[K]["sortable"] extends false ? never : K;
}[keyof F & string];

export type FilterableField<F extends FieldMap> = {
  [K in keyof F & string]: F[K]["filterable"] extends false ? never : K;
}[keyof F & string];

/**
 * Kinds that support valued operators (eq/neq/gt/gte/lt/lte/between/in/notIn).
 * `custom` values are not wire-portable, so custom fields are null-checks-only
 * (isNull/notNull) in v0.1 (ADR-0008 §6); value codecs are a v0.2 extension.
 */
export type OrderedKind = "number" | "string" | "date" | "boolean" | "enum";
/** Kinds that support contains/startsWith/endsWith. */
export type StringyKind = "string" | "enum";

export type FilterableFieldOfKind<F extends FieldMap, TK extends FieldKind> = {
  [K in keyof F & string]: F[K]["filterable"] extends false
    ? never
    : F[K]["type"] extends TK
      ? K
      : never;
}[keyof F & string];

export type SortDirection = "asc" | "desc";

export interface SortOptions {
  /** Absolute NULL placement (SQL NULLS FIRST/LAST); default per ADR-0008. */
  readonly nulls?: "first" | "last";
}

export interface GuardConfig {
  /** Max user sort conditions (default 3). Injected tie-breaker excluded. */
  readonly maxSortColumns?: number;
  /** Max filter conditions, counted as leaves (default 10). */
  readonly maxFilters?: number;
  /** Max UTF-16 length of a single value's canonical string form (default 256). */
  readonly maxValueLength?: number;
  /** Max items of an in/notIn list (default 100). */
  readonly maxInItems?: number;
  /** Max `limit` a wire may request (default: no cap). Never injects a limit. ADR-0012 §1. */
  readonly maxLimit?: number;
  /** Max errors returned by one parse/validate — the first ones, in input order (default 50). ADR-0012 §2. */
  readonly maxErrors?: number;
}

export interface QueryDefinition<F extends FieldMap> {
  readonly fields: F;
  /**
   * Unique, sortable field injected as the final sort column during apply /
   * adapter output (never into the spec). See ADR-0005.
   */
  readonly stableBy?: SortableField<F>;
  readonly guards?: GuardConfig;
}

import type { QueryResult } from "./result";

/**
 * Immutable, schema-bound query (ADR-0002). Every method returns a new
 * instance; specs built through this API are valid by construction, so
 * `stringify()` and `apply()` return plain values. Intentionally not an
 * exported type — obtain instances via `createQuery`.
 */
export interface Query<F extends FieldMap> {
  /* ---- filtering (root AND; groups arrive in v0.3) ---- */
  filter<K extends FilterableFieldOfKind<F, OrderedKind>>(
    field: K,
    op: "eq" | "neq",
    value: FieldValue<F, K>,
  ): Query<F>;
  filter<K extends FilterableFieldOfKind<F, OrderedKind>>(
    field: K,
    op: "gt" | "gte" | "lt" | "lte",
    value: FieldValue<F, K>,
  ): Query<F>;
  filter<K extends FilterableFieldOfKind<F, OrderedKind>>(
    field: K,
    op: "between",
    value: readonly [FieldValue<F, K>, FieldValue<F, K>],
  ): Query<F>;
  filter<K extends FilterableFieldOfKind<F, OrderedKind>>(
    field: K,
    op: "in" | "notIn",
    value: readonly FieldValue<F, K>[],
  ): Query<F>;
  filter<K extends FilterableFieldOfKind<F, StringyKind>>(
    field: K,
    op: "contains" | "startsWith" | "endsWith",
    value: string,
  ): Query<F>;
  /** isNull/notNull accept no value parameter (compile-enforced). */
  filter<K extends FilterableField<F>>(field: K, op: "isNull" | "notNull"): Query<F>;
  /**
   * Removes every condition on `field` — or only those using `op` when given.
   * Nothing to remove ⇒ no-op (same instance). Replace = `removeFilter` + `filter`.
   */
  removeFilter(field: FilterableField<F>, op?: Operator): Query<F>;
  /** Removes all filters. Already empty ⇒ no-op. */
  clearFilters(): Query<F>;

  /* ---- progressive sorting (ADR-0002 §2) ---- */
  /** Resets the chain; `field` becomes priority 1. */
  sort<K extends SortableField<F>>(
    field: K,
    direction?: SortDirection,
    options?: SortOptions,
  ): Query<F>;
  /** Appends without touching existing priorities; updates in place if already present. */
  thenSort<K extends SortableField<F>>(
    field: K,
    direction?: SortDirection,
    options?: SortOptions,
  ): Query<F>;
  /** Moves/inserts `field` right after `after` (appends if `after` is absent from the chain). */
  insertSortAfter<K extends SortableField<F>>(
    after: SortableField<F>,
    field: K,
    direction?: SortDirection,
    options?: SortOptions,
  ): Query<F>;
  /** Removes and renormalizes priorities to 1..n. Absent field ⇒ no-op. */
  removeSort(field: SortableField<F>): Query<F>;
  /** Flips asc/desc in place (priority and nulls kept). Absent field ⇒ no-op. */
  toggleSortDirection(field: SortableField<F>): Query<F>;
  /** Empties the sort chain. Already empty ⇒ no-op. */
  clearSorts(): Query<F>;

  /* ---- pagination (offset/limit canonical; cursor opaque in v0.1) ---- */
  limit(limit: number): Query<F>;
  offset(offset: number): Query<F>;
  /** Setting cursor clears offset and vice versa (last write wins). */
  cursor(cursor: string): Query<F>;

  /* ---- boundaries ---- */
  /** Validation boundary for external specs entering the builder. */
  withSpec(spec: QuerySpec): QueryResult<Query<F>>;
  /** The frozen canonical spec (safe to share; never mutated). */
  toSpec(): QuerySpec;
  /** Canonical string of this builder's own spec (total; ADR-0007). */
  stringify(): string;
  /** Parse against this schema. Sugar for `parseQuery(this, input)`. */
  parse(input: string): QueryResult<QuerySpec>;
  /** Non-mutating, stable, precompiled client-side execution of this builder's own spec. */
  apply<Row extends object>(rows: readonly Row[]): Row[];
}

/* ------------------------------------------------------------------ *
 * Internal runtime shapes
 * ------------------------------------------------------------------ */

export interface InternalField {
  readonly type: FieldKind;
  readonly sortable: boolean;
  readonly filterable: boolean;
  readonly alias?: string;
  /** enum kinds only */
  readonly values?: readonly string[];
  readonly valueIndex?: ReadonlyMap<string, number>;
  /** string kinds only */
  readonly locale?: string;
  readonly sensitivity?: "base" | "accent" | "case" | "variant";
  /** custom kinds only */
  readonly comparator?: (a: unknown, b: unknown) => number;
  readonly schema?: StandardSchemaV1<unknown, unknown>;
}

export interface ResolvedGuards {
  readonly maxSortColumns: number;
  readonly maxFilters: number;
  readonly maxValueLength: number;
  readonly maxInItems: number;
  /** `Infinity` when uncapped. */
  readonly maxLimit: number;
  readonly maxErrors: number;
}

export interface QueryDef {
  readonly fields: Readonly<Record<string, InternalField>>;
  /** wire token (alias if declared, else name) → internal name */
  readonly wireToName: ReadonlyMap<string, string>;
  readonly stableBy?: string;
  readonly guards: ResolvedGuards;
}
