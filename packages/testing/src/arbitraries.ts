import fc from "fast-check";
import type { VectorSchema } from "./types";

/**
 * fast-check generators over a fixed property-test schema. Values are kept
 * canonical-safe by construction (finite decimals, valid ISO dates with
 * offsets, enum members) so generated specs are canonical specs — the domain
 * of round-trip law 1a.
 */

export const PROPERTY_SCHEMA: VectorSchema = {
  stableBy: "id",
  fields: {
    id: { type: "number" },
    price: { type: "number" },
    stock: { type: "number" },
    name: { type: "string" },
    category: { type: "enum", values: ["alpha", "beta", "gamma"] },
    active: { type: "boolean" },
    createdAt: { type: "date", alias: "created" },
  },
};

export const FIELD_NAMES = [
  "id",
  "price",
  "stock",
  "name",
  "category",
  "active",
  "createdAt",
] as const;
export type PropertyField = (typeof FIELD_NAMES)[number];

const ENUM_VALUES = ["alpha", "beta", "gamma"] as const;

const ISO_DATES = [
  "2024-01-01",
  "2024-02-29",
  "2024-06-15T10:30:00Z",
  "2023-12-31T23:59:59.999Z",
  "2024-06-15T10:30:00+02:00",
  "1999-01-02T03:04:05-05:00",
] as const;

/** Strings that stress the escaping layer (conformance property #7). */
const STRUCTURAL_STRINGS = [
  ",",
  ";",
  ":",
  "%",
  "&",
  "=",
  "%2C",
  "a,b;c:d%e&f=g",
  "café +şeker",
  "  padded  ",
  "+",
  "",
  "100%",
] as const;

export const arbStringValue: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 24 }),
  fc.constantFrom(...STRUCTURAL_STRINGS),
);

/** Finite decimals with ≤2 fraction digits — canonical rendering is trivially stable. */
export const arbNumberValue: fc.Arbitrary<number> = fc
  .integer({ min: -1_000_000, max: 1_000_000 })
  .map((n) => n / 100);

function arbValueFor(field: PropertyField): fc.Arbitrary<unknown> {
  switch (PROPERTY_SCHEMA.fields[field]?.type) {
    case "number":
      return arbNumberValue;
    case "string":
      return arbStringValue;
    case "boolean":
      return fc.boolean();
    case "enum":
      return fc.constantFrom(...ENUM_VALUES);
    case "date":
      return fc.constantFrom(...ISO_DATES);
    default:
      return fc.constant(null);
  }
}

const COMPARISON_OPS = ["eq", "neq", "gt", "gte", "lt", "lte"] as const;
const STRINGY_FIELDS = ["name", "category"] as const;
const STRING_OPS = ["contains", "startsWith", "endsWith"] as const;

type ConditionOut = { kind: "condition"; field: string; op: string; value?: unknown };

export const arbCondition: fc.Arbitrary<ConditionOut> = fc.oneof(
  fc
    .tuple(fc.constantFrom(...FIELD_NAMES), fc.constantFrom(...COMPARISON_OPS))
    .chain(([field, op]) =>
      arbValueFor(field).map((value) => ({ kind: "condition" as const, field, op, value })),
    ),
  fc.constantFrom(...FIELD_NAMES).chain((field) =>
    fc
      .tuple(arbValueFor(field), arbValueFor(field))
      .map((value) => ({ kind: "condition" as const, field, op: "between", value })),
  ),
  fc
    .tuple(fc.constantFrom(...FIELD_NAMES), fc.constantFrom("in", "notIn"))
    .chain(([field, op]) =>
      fc
        .array(arbValueFor(field), { minLength: 1, maxLength: 4 })
        .map((value) => ({ kind: "condition" as const, field, op, value })),
    ),
  fc
    .tuple(fc.constantFrom(...STRINGY_FIELDS), fc.constantFrom(...STRING_OPS), arbStringValue)
    .map(([field, op, value]) => ({ kind: "condition" as const, field, op, value })),
  fc
    .tuple(fc.constantFrom(...FIELD_NAMES), fc.constantFrom("isNull", "notNull"))
    .map(([field, op]) => ({ kind: "condition" as const, field, op })),
);

export interface ArbSort {
  field: string;
  direction: "asc" | "desc";
  nulls?: "first" | "last";
  priority: number;
}

export function arbSorts(options?: {
  minLength?: number;
  maxLength?: number;
  exclude?: readonly string[];
}): fc.Arbitrary<ArbSort[]> {
  const pool = FIELD_NAMES.filter((f) => !(options?.exclude ?? []).includes(f));
  return fc
    .uniqueArray(fc.constantFrom(...pool), {
      minLength: options?.minLength ?? 0,
      maxLength: options?.maxLength ?? 3,
    })
    .chain((fields) => {
      if (fields.length === 0) return fc.constant([] as ArbSort[]);
      return fc
        .array(
          fc.record({
            direction: fc.constantFrom("asc", "desc"),
            nulls: fc.option(fc.constantFrom("first", "last"), { nil: undefined }),
          }),
          { minLength: fields.length, maxLength: fields.length },
        )
        .map((configs) =>
          fields.map((field, i) => {
            const cfg = configs[i] as { direction: "asc" | "desc"; nulls: "first" | "last" | undefined };
            return {
              field,
              direction: cfg.direction,
              ...(cfg.nulls !== undefined ? { nulls: cfg.nulls } : {}),
              priority: i + 1,
            };
          }),
        );
    });
}

const arbPagination: fc.Arbitrary<Record<string, unknown>> = fc
  .tuple(
    fc.oneof(
      fc.constant<Record<string, unknown>>({}),
      fc.nat({ max: 1000 }).map((offset) => ({ offset })),
      fc.hexaString({ minLength: 1, maxLength: 16 }).map((cursor) => ({ cursor })),
    ),
    fc.option(fc.nat({ max: 500 }), { nil: undefined }),
  )
  .map(([page, limit]) => ({ ...page, ...(limit !== undefined ? { limit } : {}) }));

/** Canonical specs — the domain of round-trip law 1a. */
export function arbCanonicalSpec(): fc.Arbitrary<Record<string, unknown>> {
  return fc
    .tuple(fc.array(arbCondition, { maxLength: 3 }), arbSorts(), arbPagination)
    .map(([filters, sorts, pagination]) => ({ filters, sorts, ...pagination }));
}

/** Rows: in-domain values, nulls, missing keys and mistyped junk (NULL class). */
export const arbRow: fc.Arbitrary<Record<string, unknown>> = fc.record(
  {
    id: fc.nat({ max: 40 }),
    price: fc.oneof(arbNumberValue, fc.constant(null), fc.constant("junk")),
    stock: arbNumberValue,
    name: fc.oneof(arbStringValue, fc.constant(null)),
    category: fc.oneof(fc.constantFrom(...ENUM_VALUES), fc.constant("unknown"), fc.constant(null)),
    active: fc.oneof(fc.boolean(), fc.constant(null)),
    createdAt: fc.oneof(fc.constantFrom(...ISO_DATES), fc.constant("not-a-date"), fc.constant(null)),
  },
  { requiredKeys: ["id"] },
);

export const arbRows: fc.Arbitrary<Array<Record<string, unknown>>> = fc.array(arbRow, {
  maxLength: 25,
});
