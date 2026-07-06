/**
 * querypipe — QueryAdapter interface (v0.2 design draft; NOT implemented in v0.1).
 *
 * Normative contract: ADR-0004. Reproduced obligations:
 *  1. Tie-breaker parity: adapters MUST inject `stableBy` as the final sort
 *     column exactly like client-side apply (ADR-0005): only when the sort
 *     chain is non-empty, ascending, skipped when already present, idempotent,
 *     never written into the spec.
 *  2. Injection safety: SQL is always parametrized; contains/startsWith/endsWith
 *     values MUST have target wildcard/metacharacters escaped before reaching
 *     LIKE/$regex. User input never becomes a pattern language.
 *  3. NULL parity: emit explicit NULLS FIRST/LAST wherever the target's default
 *     differs from the ADR-0008 reference model.
 *  4. Totality: return QueryResult errors for unsupported specs; never emit a
 *     partial query.
 */
import type { FieldSchema, QueryResult, QuerySpec, SortCondition } from "querypipe";

/** Resolved, validated schema information handed to adapters. */
export interface AdapterContext {
  readonly fields: Readonly<Record<string, FieldSchema>>;
  readonly stableBy?: string;
  /**
   * Per-field adapter mapping (v0.2 schema extension), e.g. a SQL column
   * expression for computed fields or a nested-path mapping ("author.name").
   */
  readonly mappings?: Readonly<Record<string, unknown>>;
}

export interface QueryAdapter<TOutput, TInput = never> {
  readonly name: string;
  /** `spec` is guaranteed pre-validated against the schema; adapters never re-parse. */
  toTarget(ctx: AdapterContext, spec: QuerySpec): QueryResult<TOutput>;
  /** Optional reverse direction (e.g. fromTanStackState) — two-way adapters implement both. */
  fromTarget?(ctx: AdapterContext, input: TInput): QueryResult<QuerySpec>;
}

/* ---- planned v0.2 adapter targets (shapes indicative) ---- */

export interface SqlOutput {
  /** Parametrized text: values appear only as placeholders. */
  readonly text: string;
  readonly params: readonly unknown[];
}

export interface TanStackTableState {
  readonly sorting: ReadonlyArray<{ readonly id: string; readonly desc: boolean }>;
  readonly columnFilters: ReadonlyArray<{ readonly id: string; readonly value: unknown }>;
  readonly pagination?: { readonly pageIndex: number; readonly pageSize: number };
}

export type PrismaAdapter = QueryAdapter<{
  readonly where: Record<string, unknown>;
  readonly orderBy: ReadonlyArray<Record<string, "asc" | "desc" | Record<string, string>>>;
  readonly skip?: number;
  readonly take?: number;
}>;

export type SqlAdapter = QueryAdapter<SqlOutput>;
export type MongoAdapter = QueryAdapter<{
  readonly filter: Record<string, unknown>;
  readonly sort: Readonly<Record<string, 1 | -1>>;
  readonly skip?: number;
  readonly limit?: number;
}>;
/** Two-way: table UI state is a dialect of the same contract. */
export type TanStackAdapter = QueryAdapter<TanStackTableState, TanStackTableState>;

/* ---- keyset/cursor pagination (v0.2) ---- */

/**
 * Cursor payload derived from the last row of a page over the effective sort
 * chain (user sorts + injected tie-breaker): one value per sort column.
 * Enables `WHERE (a, b, id) < (?, ?, ?)` generation.
 */
export interface KeysetCursor {
  readonly sorts: readonly SortCondition[];
  readonly values: readonly unknown[];
}
