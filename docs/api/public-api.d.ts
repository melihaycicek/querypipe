/**
 * querypipe v0.1.0 public API surface (design draft, no implementation).
 *
 * This file is the frozen contract: the runtime export list and the type export
 * list below are exhaustive. Anything not exported here (Query, GuardConfig,
 * option interfaces, …) is intentionally reachable only through inference.
 *
 * Runtime exports:
 *   createQuery,
 *   numberField, stringField, dateField, booleanField, enumField, customField,
 *   parseQuery, stringifyQuery, validateQuerySpec, canonicalize, applyQuery,
 *   isOk, isErr
 *
 * Type exports:
 *   QuerySpec, SortCondition, FilterNode, FilterCondition, FilterGroup,
 *   Operator, QueryError, QueryErrorCode, FieldSchema, QueryResult
 */

/* ------------------------------------------------------------------ *
 * Wire types (ADR-0001, ADR-0011)
 * ------------------------------------------------------------------ */

/** Closed operator set (MVP, v0.1). Tokens are identical on every wire. */
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

/**
 * A single field predicate. `kind` is a mandatory discriminator (Java
 * polymorphic deserialization; ADR-0001). `value` is absent for
 * `isNull`/`notNull`; `[T, T]` for `between`; `T[]` for `in`/`notIn`.
 */
export interface FilterCondition {
  readonly kind: "condition";
  readonly field: string;
  readonly op: Operator;
  readonly value?: unknown;
}

/**
 * Boolean group node. Present in the type system and the wire format from
 * v0.1 so that v0.3 OR groups are a pure API unlock; no v0.1 public API
 * produces it and v0.1 validation rejects it with a structured error.
 */
export interface FilterGroup {
  readonly kind: "group";
  readonly logic: "and" | "or";
  readonly children: readonly FilterNode[];
}

export type FilterNode = FilterCondition | FilterGroup;

/** One column of the progressive sort chain. `priority` is 1-based; canonical specs hold a contiguous 1..n. */
export interface SortCondition {
  readonly field: string;
  readonly direction: "asc" | "desc";
  /** Absolute placement override (SQL NULLS FIRST/LAST). Default model: ADR-0008. */
  readonly nulls?: "first" | "last";
  readonly priority: number;
}

/**
 * The language-independent query contract. Root filters combine with AND in
 * v0.1. `offset`+`limit` is the canonical pagination (there is no `page`);
 * `cursor` is mutually exclusive with `offset` (CONFLICTING_PAGINATION).
 */
export interface QuerySpec {
  readonly filters: readonly FilterNode[];
  readonly sorts: readonly SortCondition[];
  readonly limit?: number;
  readonly offset?: number;
  readonly cursor?: string;
  readonly version?: number;
}

/* ------------------------------------------------------------------ *
 * Errors & Result (ADR-0003)
 * ------------------------------------------------------------------ */

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
  /** Internal field name, or the offending raw token / segment key. */
  readonly field?: string;
  /** Raw operator token (may be an invalid one). */
  readonly op?: string;
  /** Human-readable; NOT part of the conformance contract. */
  readonly message: string;
  /** 0-based UTF-16 code-unit index into the exact parse input; best effort. */
  readonly position?: number;
}

interface QueryOk<T> {
  readonly ok: true;
  readonly value: T;
}

interface QueryErr {
  readonly ok: false;
  readonly errors: readonly QueryError[];
}

/** Data-path functions never throw; they return this. */
export type QueryResult<T> = QueryOk<T> | QueryErr;

export declare function isOk<T>(result: QueryResult<T>): result is QueryOk<T>;
export declare function isErr<T>(result: QueryResult<T>): result is QueryErr;

/* ------------------------------------------------------------------ *
 * Standard Schema (vendored type-only subset; ADR-0009)
 * ------------------------------------------------------------------ */

interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
}

type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<{ readonly message: string }> };

/* ------------------------------------------------------------------ *
 * Field schema DSL
 * ------------------------------------------------------------------ */

type FieldKind = "number" | "string" | "date" | "boolean" | "enum" | "custom";

/**
 * A field declaration. `T` is the filter-value type; the sortable/filterable
 * flags and the kind are carried as literals so the builder can narrow field
 * names and operator/value pairs at compile time.
 */
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

interface BaseFieldOptions {
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly alias?: string;
}

interface NumberFieldOptions extends BaseFieldOptions {
  readonly schema?: StandardSchemaV1<unknown, number>;
}

interface StringFieldOptions extends BaseFieldOptions {
  /** Opt-in Intl.Collator ordering. Default: UTF-16 code-unit order (ADR-0008). */
  readonly locale?: string;
  readonly sensitivity?: "base" | "accent" | "case" | "variant";
  readonly schema?: StandardSchemaV1<unknown, string>;
}

interface DateFieldOptions extends BaseFieldOptions {
  readonly schema?: StandardSchemaV1<unknown, string>;
}

interface BooleanFieldOptions extends BaseFieldOptions {
  readonly schema?: StandardSchemaV1<unknown, boolean>;
}

interface EnumFieldOptions extends BaseFieldOptions {
  readonly schema?: StandardSchemaV1<unknown, string>;
}

interface CustomFieldOptions<T> extends BaseFieldOptions {
  /** Sort basis. Never receives NULL-class values (ADR-0008 §3). */
  readonly comparator: (a: T, b: T) => number;
  readonly schema?: StandardSchemaV1<unknown, T>;
}

/** `{ sortable: false }` narrows to `false`; anything else resolves `true`. */
type ResolvedFlag<O, K extends keyof BaseFieldOptions> = O extends Record<K, false> ? false : true;

/** Filter/sort input type for date fields; normalized to an ISO string in the spec (ADR-0011 §3). */
type DateInput = Date | string | number;

export declare function numberField<const O extends NumberFieldOptions = {}>(
  options?: O,
): FieldSchema<number, ResolvedFlag<O, "sortable">, ResolvedFlag<O, "filterable">, "number">;

export declare function stringField<const O extends StringFieldOptions = {}>(
  options?: O,
): FieldSchema<string, ResolvedFlag<O, "sortable">, ResolvedFlag<O, "filterable">, "string">;

export declare function dateField<const O extends DateFieldOptions = {}>(
  options?: O,
): FieldSchema<DateInput, ResolvedFlag<O, "sortable">, ResolvedFlag<O, "filterable">, "date">;

export declare function booleanField<const O extends BooleanFieldOptions = {}>(
  options?: O,
): FieldSchema<boolean, ResolvedFlag<O, "sortable">, ResolvedFlag<O, "filterable">, "boolean">;

/** Value type narrows to the literal union of `values`; comparison order is declaration order. */
export declare function enumField<
  const V extends readonly [string, ...string[]],
  const O extends EnumFieldOptions = {},
>(
  values: V,
  options?: O,
): FieldSchema<V[number], ResolvedFlag<O, "sortable">, ResolvedFlag<O, "filterable">, "enum">;

export declare function customField<T, const O extends BaseFieldOptions = {}>(
  options: O & CustomFieldOptions<T>,
): FieldSchema<T, ResolvedFlag<O, "sortable">, ResolvedFlag<O, "filterable">, "custom">;

/* ------------------------------------------------------------------ *
 * Schema-bound query builder (immutable; ADR-0002)
 * ------------------------------------------------------------------ */

type AnyFieldSchema = FieldSchema<any, boolean, boolean, FieldKind>;
type FieldMap = Record<string, AnyFieldSchema>;

type FieldValue<F extends FieldMap, K extends keyof F> =
  F[K] extends FieldSchema<infer T, boolean, boolean, FieldKind> ? T : never;

type SortableField<F extends FieldMap> = {
  [K in keyof F & string]: F[K]["sortable"] extends false ? never : K;
}[keyof F & string];

type FilterableField<F extends FieldMap> = {
  [K in keyof F & string]: F[K]["filterable"] extends false ? never : K;
}[keyof F & string];

/**
 * Kinds that support valued operators (eq/neq/gt/gte/lt/lte/between/in/notIn).
 * `custom` values are not wire-portable, so custom fields are null-checks-only
 * (isNull/notNull) in v0.1 (ADR-0008 §6); value codecs are a v0.2 extension.
 */
type OrderedKind = "number" | "string" | "date" | "boolean" | "enum";
/** Kinds that support contains/startsWith/endsWith. */
type StringyKind = "string" | "enum";

type FilterableFieldOfKind<F extends FieldMap, TK extends FieldKind> = {
  [K in keyof F & string]: F[K]["filterable"] extends false
    ? never
    : F[K]["type"] extends TK
      ? K
      : never;
}[keyof F & string];

type SortDirection = "asc" | "desc";

interface SortOptions {
  /** Absolute NULL placement (SQL NULLS FIRST/LAST); default per ADR-0008. */
  readonly nulls?: "first" | "last";
}

interface GuardConfig {
  /** Max user sort conditions (default 3). Injected tie-breaker excluded. */
  readonly maxSortColumns?: number;
  /** Max filter conditions, counted as leaves (default 10). */
  readonly maxFilters?: number;
  /** Max UTF-16 length of a single decoded value (default 256). */
  readonly maxValueLength?: number;
  /** Max items of an in/notIn list (default 100). */
  readonly maxInItems?: number;
}

interface QueryDefinition<F extends FieldMap> {
  readonly fields: F;
  /**
   * Unique, sortable field injected as the final sort column during apply /
   * adapter output (never into the spec). See ADR-0005.
   */
  readonly stableBy?: SortableField<F>;
  readonly guards?: GuardConfig;
}

/**
 * Immutable, schema-bound query. Every method returns a new instance; specs
 * built through this API are valid by construction, so `stringify()` and
 * `apply()` return plain values (external specs go through the Result-returning
 * top-level functions instead). Intentionally not an exported type.
 */
interface Query<F extends FieldMap> {
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
  /** Moves/inserts `field` right after `after` (appends if `after` is absent). */
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
 * Runtime API
 * ------------------------------------------------------------------ */

/**
 * Create a schema-bound immutable query (the schema handle for all top-level
 * functions). Structural misuse of the definition (bad identifiers, duplicate
 * wire names, unknown/unsortable stableBy) throws TypeError (ADR-0003 §2);
 * data-path errors never throw.
 */
export declare function createQuery<F extends FieldMap>(definition: QueryDefinition<F>): Query<F>;

/** Parse a canonical query string against the schema. Never throws (ADR-0003). */
export declare function parseQuery<F extends FieldMap>(
  query: Query<F>,
  input: string,
): QueryResult<QuerySpec>;

/**
 * Deterministic canonical string for `spec` (or the query's own spec when
 * omitted). External specs are validated first: unserializable specs (unknown
 * fields, v0.1 group nodes, guard breaches) yield errors, never partial output.
 */
export declare function stringifyQuery<F extends FieldMap>(
  query: Query<F>,
  spec?: QuerySpec,
): QueryResult<string>;

/** Validate an externally produced spec against schema + guards. Returns the spec unchanged on ok. */
export declare function validateQuerySpec<F extends FieldMap>(
  query: Query<F>,
  spec: QuerySpec,
): QueryResult<QuerySpec>;

/** `stringify ∘ parse` — idempotent canonicalization of any accepted input (ADR-0007 §6). */
export declare function canonicalize<F extends FieldMap>(
  query: Query<F>,
  input: string,
): QueryResult<string>;

/**
 * Client-side execution of an external spec: validate, filter (AND), stable
 * sort with precompiled comparator + stableBy tie-breaker, offset/limit slice.
 * Non-mutating (`toSorted` semantics). Specs carrying `cursor` are rejected in
 * v0.1 (keyset execution is v0.2).
 */
export declare function applyQuery<F extends FieldMap, Row extends object>(
  query: Query<F>,
  spec: QuerySpec,
  rows: readonly Row[],
): QueryResult<Row[]>;
