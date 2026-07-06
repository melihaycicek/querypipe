import type { QueryError } from "./types";

export interface QueryOk<T> {
  readonly ok: true;
  readonly value: T;
}

export interface QueryErr {
  readonly ok: false;
  readonly errors: readonly QueryError[];
}

/** Data-path functions never throw; they return this (ADR-0003). */
export type QueryResult<T> = QueryOk<T> | QueryErr;

export function isOk<T>(result: QueryResult<T>): result is QueryOk<T> {
  return result.ok;
}

export function isErr<T>(result: QueryResult<T>): result is QueryErr {
  return !result.ok;
}

export function ok<T>(value: T): QueryOk<T> {
  return { ok: true, value };
}

export function err(errors: readonly QueryError[]): QueryErr {
  return { ok: false, errors };
}
