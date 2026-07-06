import type { QueryError, QueryErrorCode } from "./types";

/** Build a QueryError without undefined-valued keys (wire hygiene, ADR-0011 §1). */
export function qerr(
  code: QueryErrorCode,
  message: string,
  extras?: { field?: string; op?: string; position?: number },
): QueryError {
  const e: { code: QueryErrorCode; message: string; field?: string; op?: string; position?: number } =
    { code, message };
  if (extras) {
    if (extras.field !== undefined) e.field = extras.field;
    if (extras.op !== undefined) e.op = extras.op;
    if (extras.position !== undefined) e.position = extras.position;
  }
  return e;
}

/** Cap raw tokens quoted inside error messages. */
export function truncate(token: string): string {
  return token.length > 40 ? `${token.slice(0, 40)}…` : token;
}
