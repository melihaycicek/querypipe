import { tokenToValue, runStandardSchema } from "./convert";
import { decodeValue } from "./encode";
import { qerr, truncate } from "./errors";
import { deepFreezeSpec } from "./freeze";
import { applyGuards } from "./guards";
import { OPERATORS, isOperator, isStringOp } from "./ops";
import { err, ok, type QueryResult } from "./result";
import type { FilterCondition, QueryDef, QueryError, QuerySpec, SortCondition } from "./types";

/**
 * Canonical string-format parser (grammar: docs/spec/query-string.md).
 * Lenient in (segment order, omitted direction, non-canonical escapes),
 * canonical out; collects every independent error; never throws (ADR-0003).
 * Positions are 0-based UTF-16 indices into the exact input, best effort.
 * Error `message` text is non-normative (ADR-0003 §6) and kept terse for the
 * bundle budget — machine context lives in code/field/op/position.
 */

const SEGMENT_KEYS: ReadonlySet<string> = new Set([
  "sort",
  "filter",
  "offset",
  "limit",
  "cursor",
  "version",
]);
const UINT_RE = /^\d+$/;
const MSG_UINT = "non-negative integer required";
const MSG_PCT = "invalid percent-encoding";

interface Part {
  readonly text: string;
  readonly start: number;
}

function splitParts(text: string, sep: string, base: number): Part[] {
  const parts: Part[] = [];
  let start = 0;
  for (;;) {
    const idx = text.indexOf(sep, start);
    if (idx < 0) {
      parts.push({ text: text.slice(start), start: base + start });
      return parts;
    }
    parts.push({ text: text.slice(start, idx), start: base + start });
    start = idx + 1;
  }
}

function parseUint(token: string): number | undefined {
  if (!UINT_RE.test(token)) return undefined;
  const n = Number(token);
  return Number.isSafeInteger(n) ? n : undefined;
}

export function parseSpec(def: QueryDef, input: string): QueryResult<QuerySpec> {
  const errors: QueryError[] = [];
  const sorts: SortCondition[] = [];
  const filters: FilterCondition[] = [];
  let limit: number | undefined;
  let offset: number | undefined;
  let cursor: string | undefined;
  let version: number | undefined;

  if (input !== "") {
    const seen = new Set<string>();
    for (const seg of splitParts(input, "&", 0)) {
      const bad = (message: string, field?: string, position = seg.start) => {
        errors.push(qerr("INVALID_VALUE", message, field === undefined ? { position } : { field, position }));
      };
      if (seg.text === "") {
        bad("empty segment");
        continue;
      }
      const eq = seg.text.indexOf("=");
      if (eq < 0) {
        bad(`malformed segment "${truncate(seg.text)}"`);
        continue;
      }
      const key = seg.text.slice(0, eq);
      const rest = seg.text.slice(eq + 1);
      const restStart = seg.start + eq + 1;
      if (!SEGMENT_KEYS.has(key)) {
        errors.push(
          qerr("UNKNOWN_FIELD", `unknown segment "${truncate(key)}"`, { field: key, position: seg.start }),
        );
        continue;
      }
      if (seen.has(key)) {
        bad(`duplicate segment "${key}"`, key);
        continue;
      }
      seen.add(key);

      switch (key) {
        case "sort":
          parseSorts(def, rest, restStart, sorts, errors);
          break;
        case "filter":
          parseFilters(def, rest, restStart, filters, errors);
          break;
        case "offset":
        case "limit": {
          const n = parseUint(rest);
          if (n === undefined) bad(MSG_UINT, key, restStart);
          else if (key === "offset") offset = n;
          else limit = n;
          break;
        }
        case "cursor": {
          if (rest === "") {
            bad("empty cursor", "cursor");
            break;
          }
          const decoded = decodeValue(rest);
          if (decoded === null) bad(MSG_PCT, "cursor", restStart);
          else cursor = decoded;
          break;
        }
        case "version": {
          if (rest === "1") version = 1;
          else bad("unsupported version (expected 1)", "version", restStart);
          break;
        }
      }
    }
  }

  const spec: QuerySpec = {
    filters,
    sorts,
    ...(limit !== undefined ? { limit } : {}),
    ...(offset !== undefined ? { offset } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
    ...(version !== undefined ? { version } : {}),
  };

  errors.push(...applyGuards(def, spec));
  if (offset !== undefined && cursor !== undefined) {
    errors.push(qerr("CONFLICTING_PAGINATION", "offset and cursor are mutually exclusive"));
  }

  return errors.length > 0 ? err(errors) : ok(deepFreezeSpec(spec));
}

function parseSorts(
  def: QueryDef,
  text: string,
  base: number,
  sorts: SortCondition[],
  errors: QueryError[],
): void {
  const seenFields = new Set<string>();
  for (const item of splitParts(text, ",", base)) {
    const bad = (message: string, field?: string, position = item.start) => {
      errors.push(qerr("INVALID_VALUE", message, field === undefined ? { position } : { field, position }));
    };
    if (item.text === "") {
      bad("empty sort item");
      continue;
    }
    const parts = item.text.split(":");
    const raw = parts[0] as string;
    const name = def.wireToName.get(raw);
    if (name === undefined) {
      errors.push(qerr("UNKNOWN_FIELD", "unknown field", { field: raw, position: item.start }));
      continue;
    }
    if (!(def.fields[name] as QueryDef["fields"][string]).sortable) {
      errors.push(qerr("NOT_SORTABLE", "not sortable", { field: name, position: item.start }));
      continue;
    }
    if (parts.length > 3) {
      bad("too many sort parts", name);
      continue;
    }
    let direction: "asc" | "desc" = "asc";
    if (parts.length >= 2) {
      const d = parts[1] as string;
      if (d !== "asc" && d !== "desc") {
        bad(`invalid direction "${truncate(d)}"`, name, item.start + raw.length + 1);
        continue;
      }
      direction = d;
    }
    let nulls: "first" | "last" | undefined;
    if (parts.length === 3) {
      const n = parts[2] as string;
      if (n !== "nullsfirst" && n !== "nullslast") {
        bad(`invalid nulls token "${truncate(n)}"`, name, item.start + raw.length + 1 + (parts[1] as string).length + 1);
        continue;
      }
      nulls = n === "nullsfirst" ? "first" : "last";
    }
    if (seenFields.has(name)) {
      bad("duplicate sort field", name);
      continue;
    }
    seenFields.add(name);
    sorts.push({
      field: name,
      direction,
      ...(nulls !== undefined ? { nulls } : {}),
      priority: sorts.length + 1,
    });
  }
}

function parseFilters(
  def: QueryDef,
  text: string,
  base: number,
  filters: FilterCondition[],
  errors: QueryError[],
): void {
  for (const item of splitParts(text, ";", base)) {
    if (item.text === "") {
      errors.push(qerr("INVALID_VALUE", "empty filter item", { position: item.start }));
      continue;
    }
    const parts = item.text.split(":");
    const raw = parts[0] as string;
    const name = def.wireToName.get(raw);
    if (name === undefined) {
      errors.push(qerr("UNKNOWN_FIELD", "unknown field", { field: raw, position: item.start }));
      continue;
    }
    const field = def.fields[name] as QueryDef["fields"][string];
    if (!field.filterable) {
      errors.push(qerr("NOT_FILTERABLE", "not filterable", { field: name, position: item.start }));
      continue;
    }
    if (parts.length < 2) {
      errors.push(qerr("INVALID_VALUE", "missing operator", { field: name, position: item.start }));
      continue;
    }
    const opToken = parts[1] as string;
    const opStart = item.start + raw.length + 1;
    const bad = (code: QueryError["code"], message: string, position = item.start) => {
      errors.push(qerr(code, message, { field: name, op: opToken, position }));
    };
    if (!isOperator(opToken)) {
      bad("INVALID_OPERATOR", "unknown operator", opStart);
      continue;
    }
    const meta = OPERATORS[opToken];
    if (!meta.kinds.includes(field.type)) {
      bad("INVALID_OPERATOR", `not applicable to ${field.type} field`, opStart);
      continue;
    }

    if (meta.arity === "none") {
      if (parts.length !== 2) {
        bad("INVALID_VALUE", "takes no value");
        continue;
      }
      filters.push({ kind: "condition", field: name, op: opToken });
      continue;
    }

    if (parts.length !== 3) {
      bad("INVALID_VALUE", parts.length < 3 ? "missing value" : "unencoded ':' in value (use %3A)");
      continue;
    }

    const valuesStart = opStart + opToken.length + 1;
    const values: unknown[] = [];
    let itemFailed = false;
    for (const rawValue of splitParts(parts[2] as string, ",", valuesStart)) {
      const decoded = decodeValue(rawValue.text);
      if (decoded === null) {
        bad("INVALID_VALUE", MSG_PCT, rawValue.start);
        itemFailed = true;
        continue;
      }
      // String-operator values are plain fragments — never converted to the field's kind domain.
      const converted = isStringOp(opToken)
        ? ({ ok: true, value: decoded } as const)
        : tokenToValue(field, decoded);
      if (!converted.ok) {
        bad("INVALID_VALUE", converted.reason, rawValue.start);
        itemFailed = true;
        continue;
      }
      let value = converted.value;
      if (field.schema && !isStringOp(opToken)) {
        // parseQuery adopts the validator's (possibly transformed) output (ADR-0009 §2).
        const run = runStandardSchema(field.schema, value);
        if (!run.ok) {
          bad("INVALID_VALUE", run.reason, rawValue.start);
          itemFailed = true;
          continue;
        }
        value = run.value;
      }
      values.push(value);
    }
    if (itemFailed) continue;

    if (meta.arity === "one" && values.length !== 1) {
      bad("INVALID_VALUE", "expects one value (encode ',' as %2C)", valuesStart);
      continue;
    }
    if (meta.arity === "two" && values.length !== 2) {
      bad("INVALID_VALUE", "expects two values", valuesStart);
      continue;
    }

    filters.push({
      kind: "condition",
      field: name,
      op: opToken,
      value: meta.arity === "one" ? values[0] : values,
    });
  }
}
