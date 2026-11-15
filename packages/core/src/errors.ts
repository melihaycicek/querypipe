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

/**
 * Cap raw wire tokens echoed back in errors (`field`, `op`, message text) at
 * 64 UTF-16 code units + "…" so error size never scales with input size
 * (ADR-0012 §2). Declared schema field names are never truncated.
 */
export function truncate(token: string): string {
  return token.length > 64 ? `${token.slice(0, 64)}…` : token;
}
