import { applySpecToRows } from "./apply";
import { checkJsonValue } from "./convert";
import { deepFreezeSpec } from "./freeze";
import { resolveGuards } from "./guards";
import { OPERATORS, isOperator, isStringOp } from "./ops";
import { parseSpec } from "./parse";
import { err, ok, type QueryResult } from "./result";
import { stringifySpec } from "./stringify";
import { validateSpecInternal } from "./validate";
import type {
  FieldKind,
  FilterCondition,
  GuardConfig,
  InternalField,
  Operator,
  QueryDef,
  QuerySpec,
  SortCondition,
  StandardSchemaV1,
} from "./types";

/**
 * The immutable builder (ADR-0002) and schema construction. Error regimes per
 * ADR-0003: schema/builder misuse throws TypeError; data-path methods
 * (parse/withSpec) return Results and never throw. Builder specs are valid by
 * construction, so stringify()/apply() return plain values.
 */

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const KINDS: ReadonlySet<string> = new Set(["number", "string", "date", "boolean", "enum", "custom"]);
const SENSITIVITIES: ReadonlySet<string> = new Set(["base", "accent", "case", "variant"]);

export const EMPTY_SPEC: QuerySpec = deepFreezeSpec({ filters: [], sorts: [] });

/** Construction/builder misuse is a programmer error and throws (ADR-0003 §2). */
function fail(message: string): never {
  throw new TypeError(message);
}

function normalizeField(name: string, raw: unknown): InternalField {
  if (raw === null || typeof raw !== "object") fail(`"${name}": use a field constructor`);
  const f = raw as Record<string, unknown>;
  const type = f.type;
  if (typeof type !== "string" || !KINDS.has(type)) fail(`"${name}": invalid type`);
  if (f.sortable !== undefined && typeof f.sortable !== "boolean") fail(`"${name}": sortable must be boolean`);
  if (f.filterable !== undefined && typeof f.filterable !== "boolean") {
    fail(`"${name}": filterable must be boolean`);
  }
  if (f.alias !== undefined && (typeof f.alias !== "string" || !IDENT_RE.test(f.alias))) {
    fail(`"${name}": invalid alias`);
  }

  const out: {
    type: FieldKind;
    sortable: boolean;
    filterable: boolean;
    alias?: string;
    values?: readonly string[];
    valueIndex?: ReadonlyMap<string, number>;
    locale?: string;
    sensitivity?: "base" | "accent" | "case" | "variant";
    comparator?: (a: unknown, b: unknown) => number;
    schema?: StandardSchemaV1<unknown, unknown>;
  } = {
    type: type as FieldKind,
    sortable: f.sortable !== false,
    filterable: f.filterable !== false,
  };
  if (typeof f.alias === "string") out.alias = f.alias;

  if (f.schema !== undefined) {
    const std = (f.schema as { "~standard"?: unknown })["~standard"] as
      | { validate?: unknown; version?: unknown }
      | null
      | undefined;
    if (std === null || typeof std !== "object" || typeof std.validate !== "function") {
      fail(`"${name}": schema must implement Standard Schema v1`);
    }
    out.schema = f.schema as StandardSchemaV1<unknown, unknown>;
  }

  if (type === "enum") {
    const values = f.values;
    if (!Array.isArray(values) || values.length === 0 || values.some((v) => typeof v !== "string")) {
      fail(`"${name}": enum requires non-empty string values`);
    }
    if (new Set(values).size !== values.length) fail(`"${name}": duplicate enum values`);
    const frozen = Object.freeze([...(values as string[])]);
    out.values = frozen;
    out.valueIndex = new Map(frozen.map((v, i) => [v, i]));
  }

  if (type === "string") {
    if (f.locale !== undefined) {
      if (typeof f.locale !== "string") fail(`"${name}": invalid locale`);
      out.locale = f.locale;
    }
    if (f.sensitivity !== undefined) {
      if (typeof f.sensitivity !== "string" || !SENSITIVITIES.has(f.sensitivity)) {
        fail(`"${name}": invalid sensitivity`);
      }
      out.sensitivity = f.sensitivity as "base" | "accent" | "case" | "variant";
    }
  }

  if (type === "custom") {
    if (typeof f.comparator !== "function") fail(`"${name}": comparator function required`);
    out.comparator = f.comparator as (a: unknown, b: unknown) => number;
  }

  return out;
}

export function buildDef(definition: unknown): QueryDef {
  if (definition === null || typeof definition !== "object") fail("invalid createQuery definition");
  const d = definition as { fields?: unknown; stableBy?: unknown; guards?: unknown };
  if (d.fields === null || typeof d.fields !== "object" || Array.isArray(d.fields)) {
    fail("fields must be an object");
  }

  // Prototype-less: `fields[name]` must only ever see declared fields, never
  // Object.prototype members such as "constructor" or "__proto__" (ADR-0012 §5).
  const fields: Record<string, InternalField> = Object.create(null);
  const wireToName = new Map<string, string>();
  for (const [name, raw] of Object.entries(d.fields as Record<string, unknown>)) {
    if (!IDENT_RE.test(name)) fail(`invalid field name "${name}"`);
    const field = normalizeField(name, raw);
    fields[name] = field;
    const wire = field.alias ?? name;
    if (wireToName.has(wire)) fail(`duplicate wire name "${wire}"`);
    wireToName.set(wire, name);
  }

  let stableBy: string | undefined;
  if (d.stableBy !== undefined) {
    if (typeof d.stableBy !== "string") fail("invalid stableBy");
    const target = fields[d.stableBy];
    if (target === undefined) fail(`unknown stableBy field "${d.stableBy}"`);
    if (!target.sortable) fail("stableBy must be sortable");
    stableBy = d.stableBy;
  }

  return {
    fields,
    wireToName,
    ...(stableBy !== undefined ? { stableBy } : {}),
    guards: resolveGuards(d.guards as GuardConfig | undefined),
  };
}

function normalizePage(value: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label}: finite number required`);
  return Math.max(0, Math.floor(value));
}

export class QueryImpl {
  constructor(
    readonly def: QueryDef,
    readonly spec: QuerySpec,
  ) {}

  private next(spec: QuerySpec): QueryImpl {
    return new QueryImpl(this.def, deepFreezeSpec(spec));
  }

  private fieldFor(field: string): InternalField {
    const f = this.def.fields[field];
    if (f === undefined) fail(`unknown field "${String(field)}"`);
    return f;
  }

  /* ---- filtering ---- */

  filter(field: string, op: Operator, value?: unknown): QueryImpl {
    const f = this.fieldFor(field);
    if (!f.filterable) fail(`"${field}" is not filterable`);
    if (typeof op !== "string" || !isOperator(op)) fail(`unknown operator "${String(op)}"`);
    const meta = OPERATORS[op];
    if (!meta.kinds.includes(f.type)) fail(`"${op}" not applicable to ${f.type} "${field}"`);

    let cond: FilterCondition;
    if (meta.arity === "none") {
      if (value !== undefined) fail(`${op} takes no value`);
      cond = { kind: "condition", field, op };
    } else if (meta.arity === "one") {
      cond = { kind: "condition", field, op, value: builderValue(f, field, op, value) };
    } else if (meta.arity === "two") {
      if (!Array.isArray(value) || value.length !== 2) fail("between expects [min, max]");
      cond = {
        kind: "condition",
        field,
        op,
        value: [builderValue(f, field, op, value[0]), builderValue(f, field, op, value[1])],
      };
    } else {
      if (!Array.isArray(value) || value.length === 0) fail(`${op} expects a non-empty array`);
      cond = { kind: "condition", field, op, value: value.map((v) => builderValue(f, field, op, v)) };
    }
    return this.next({ ...this.spec, filters: [...this.spec.filters, cond] });
  }

  removeFilter(field: string, op?: string): QueryImpl {
    this.fieldFor(field);
    if (op !== undefined && !isOperator(op)) fail(`unknown operator "${String(op)}"`);
    const filters = this.spec.filters.filter(
      (n) => !(n.kind === "condition" && n.field === field && (op === undefined || n.op === op)),
    );
    return filters.length === this.spec.filters.length ? this : this.next({ ...this.spec, filters });
  }

  clearFilters(): QueryImpl {
    return this.spec.filters.length === 0 ? this : this.next({ ...this.spec, filters: [] });
  }

  /* ---- progressive sorting (ADR-0002 §2) ---- */

  private sortItem(
    field: string,
    direction: string | undefined,
    options: { readonly nulls?: string } | undefined,
  ): SortCondition {
    const f = this.fieldFor(field);
    if (!f.sortable) fail(`"${field}" is not sortable`);
    if (direction !== undefined && direction !== "asc" && direction !== "desc") {
      fail("invalid direction (asc | desc)");
    }
    const nulls = options?.nulls;
    if (nulls !== undefined && nulls !== "first" && nulls !== "last") {
      fail("invalid nulls option (first | last)");
    }
    return {
      field,
      direction: (direction ?? "asc") as "asc" | "desc",
      ...(nulls !== undefined ? { nulls: nulls as "first" | "last" } : {}),
      priority: 0, // renumbered by withSorts
    };
  }

  private withSorts(sorts: readonly SortCondition[]): QueryImpl {
    const renumbered = sorts.map((s, i) => (s.priority === i + 1 ? s : { ...s, priority: i + 1 }));
    return this.next({ ...this.spec, sorts: renumbered });
  }

  sort(field: string, direction?: string, options?: { readonly nulls?: string }): QueryImpl {
    return this.withSorts([this.sortItem(field, direction, options)]);
  }

  thenSort(field: string, direction?: string, options?: { readonly nulls?: string }): QueryImpl {
    const item = this.sortItem(field, direction, options);
    const sorts = [...this.spec.sorts];
    const idx = sorts.findIndex((s) => s.field === field);
    if (idx >= 0) sorts[idx] = item; // update in place, keep chain position
    else sorts.push(item);
    return this.withSorts(sorts);
  }

  insertSortAfter(
    after: string,
    field: string,
    direction?: string,
    options?: { readonly nulls?: string },
  ): QueryImpl {
    this.fieldFor(after); // must be a declared field; absence from the chain is fine
    const item = this.sortItem(field, direction, options);
    const sorts = this.spec.sorts.filter((s) => s.field !== field);
    const idx = sorts.findIndex((s) => s.field === after);
    if (idx < 0) sorts.push(item);
    else sorts.splice(idx + 1, 0, item);
    return this.withSorts(sorts);
  }

  removeSort(field: string): QueryImpl {
    this.fieldFor(field);
    const sorts = this.spec.sorts.filter((s) => s.field !== field);
    if (sorts.length === this.spec.sorts.length) return this;
    return this.withSorts(sorts);
  }

  toggleSortDirection(field: string): QueryImpl {
    this.fieldFor(field);
    const idx = this.spec.sorts.findIndex((s) => s.field === field);
    if (idx < 0) return this;
    const sorts = [...this.spec.sorts];
    const current = sorts[idx] as SortCondition;
    sorts[idx] = { ...current, direction: current.direction === "asc" ? "desc" : "asc" };
    return this.withSorts(sorts);
  }

  clearSorts(): QueryImpl {
    return this.spec.sorts.length === 0 ? this : this.withSorts([]);
  }

  /* ---- pagination (cursor ⊕ offset enforced structurally) ---- */

  limit(limit: number): QueryImpl {
    return this.next({ ...this.spec, limit: normalizePage(limit, "limit") });
  }

  offset(offset: number): QueryImpl {
    const { cursor: _cursor, ...rest } = this.spec;
    return this.next({ ...rest, offset: normalizePage(offset, "offset") });
  }

  cursor(cursor: string): QueryImpl {
    if (typeof cursor !== "string" || cursor.length === 0) fail("cursor: non-empty string required");
    const { offset: _offset, ...rest } = this.spec;
    return this.next({ ...rest, cursor });
  }

  /* ---- boundaries ---- */

  withSpec(spec: QuerySpec): QueryResult<QueryImpl> {
    const errors = validateSpecInternal(this.def, spec);
    if (errors.length > 0) return err(errors);
    // Entering the builder is a canonicalization point: renormalize priorities
    // and deep-clone via JSON (validated specs are JSON-safe; undefined-valued
    // keys are stripped, wire hygiene per ADR-0011 §1).
    const sorts = [...spec.sorts]
      .sort((a, b) => a.priority - b.priority)
      .map((s, i) => ({ ...s, priority: i + 1 }));
    const { filters, limit, offset, cursor, version } = spec;
    const clean = JSON.parse(
      JSON.stringify({ filters, sorts, limit, offset, cursor, version }),
    ) as QuerySpec;
    return ok(this.next(clean));
  }

  toSpec(): QuerySpec {
    return this.spec;
  }

  stringify(): string {
    return stringifySpec(this.def, this.spec);
  }

  parse(input: string): QueryResult<QuerySpec> {
    return parseSpec(this.def, input);
  }

  apply<Row extends object>(rows: readonly Row[]): Row[] {
    if (this.spec.cursor !== undefined) fail("cursor is not executable client-side in v0.1");
    return applySpecToRows(this.def, this.spec, rows);
  }
}

function builderValue(f: InternalField, field: string, op: Operator, value: unknown): unknown {
  if (isStringOp(op)) {
    if (typeof value !== "string") fail(`${op} expects a string`);
    return value;
  }
  // Date inputs are normalized to ISO strings at entry — specs are wire-ready (ADR-0011 §3).
  if (f.type === "date") {
    if (value instanceof Date || typeof value === "number") {
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) fail(`"${field}": invalid date`);
      value = d.toISOString();
    }
  }
  const converted = checkJsonValue(f, value);
  if (!converted.ok) fail(`"${field}": ${converted.reason}`);
  return converted.value;
}
