/**
 * Display tokenizer for the querypipe canonical query-string grammar
 * (docs/spec/query-string.md). Pure lexical coloring for UI — it never
 * validates; correctness verdicts come from `querypipe`'s real `parse`.
 *
 * Token types mirror the grammar: segment keys, fields, operators/directions,
 * values, structural separators, and lexically-unknown text. Offsets are
 * 0-based UTF-16 indices into the input, matching `QueryError.position`.
 */

export type TokenType = "key" | "field" | "op" | "value" | "sep" | "err";

export interface QueryToken {
  type: TokenType;
  text: string;
  /** Inclusive start offset. */
  start: number;
  /** Exclusive end offset. */
  end: number;
}

const SEGMENT_KEYS = new Set(["sort", "filter", "offset", "limit", "cursor", "version"]);
const OPERATORS = new Set([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "notIn",
  "between",
  "contains",
  "startsWith",
  "endsWith",
  "isNull",
  "notNull",
]);
const DIRECTIONS = new Set(["asc", "desc"]);
const NULLS_TOKENS = new Set(["nullsfirst", "nullslast"]);

export function tokenizeCanonical(input: string): QueryToken[] {
  const tokens: QueryToken[] = [];
  const push = (type: TokenType, start: number, end: number) => {
    if (end > start) tokens.push({ type, text: input.slice(start, end), start, end });
  };

  /** Split `input[start..end)` on `sep`, calling `each(partStart, partEnd)`; emits sep tokens. */
  const splitOn = (
    start: number,
    end: number,
    sep: string,
    each: (s: number, e: number, index: number) => void,
  ) => {
    let partStart = start;
    let index = 0;
    for (let i = start; i < end; i++) {
      if (input[i] === sep) {
        each(partStart, i, index++);
        push("sep", i, i + 1);
        partStart = i + 1;
      }
    }
    each(partStart, end, index);
  };

  const sortItem = (s: number, e: number) => {
    splitOn(s, e, ":", (ps, pe, i) => {
      if (i === 0) push("field", ps, pe);
      else if (i === 1) push(DIRECTIONS.has(input.slice(ps, pe)) ? "op" : "err", ps, pe);
      else if (i === 2) push(NULLS_TOKENS.has(input.slice(ps, pe)) ? "op" : "err", ps, pe);
      else push("err", ps, pe);
    });
  };

  const filterItem = (s: number, e: number) => {
    // field ":" op [":" valueList] — the value area starts after the 2nd ":".
    const c1 = input.indexOf(":", s);
    if (c1 === -1 || c1 >= e) {
      push("field", s, e);
      return;
    }
    push("field", s, c1);
    push("sep", c1, c1 + 1);
    const c2 = input.indexOf(":", c1 + 1);
    const opEnd = c2 === -1 || c2 >= e ? e : c2;
    push(OPERATORS.has(input.slice(c1 + 1, opEnd)) ? "op" : "err", c1 + 1, opEnd);
    if (opEnd < e) {
      push("sep", opEnd, opEnd + 1);
      splitOn(opEnd + 1, e, ",", (ps, pe) => push("value", ps, pe));
    }
  };

  splitOn(0, input.length, "&", (segStart, segEnd) => {
    if (segEnd === segStart) return;
    const eq = input.indexOf("=", segStart);
    if (eq === -1 || eq >= segEnd) {
      push("err", segStart, segEnd);
      return;
    }
    const key = input.slice(segStart, eq);
    push(SEGMENT_KEYS.has(key) ? "key" : "err", segStart, eq);
    push("sep", eq, eq + 1);
    const restStart = eq + 1;
    if (restStart >= segEnd) return;
    switch (key) {
      case "sort":
        splitOn(restStart, segEnd, ",", (ps, pe) => sortItem(ps, pe));
        break;
      case "filter":
        splitOn(restStart, segEnd, ";", (ps, pe) => filterItem(ps, pe));
        break;
      default:
        push("value", restStart, segEnd);
    }
  });

  return tokens;
}

/**
 * Underline ranges for parse errors. `QueryError.position` is a 0-based index
 * into the input; when it falls inside a grammar token we underline that
 * whole token (its span is known from the grammar, not guessed), otherwise
 * exactly one character. Errors without a position produce no range.
 */
export function errorRanges(
  input: string,
  errors: readonly { position?: number }[],
  tokens: readonly QueryToken[] = tokenizeCanonical(input),
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const error of errors) {
    const pos = error.position;
    if (pos === undefined || pos < 0 || pos >= input.length) continue;
    const token = tokens.find((t) => t.type !== "sep" && t.start <= pos && pos < t.end);
    ranges.push(token ? { start: token.start, end: token.end } : { start: pos, end: pos + 1 });
  }
  return ranges;
}
