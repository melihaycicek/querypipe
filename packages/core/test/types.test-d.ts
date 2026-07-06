import { expectTypeOf, it } from "vitest";
import {
  booleanField,
  createQuery,
  customField,
  dateField,
  enumField,
  numberField,
  stringField,
} from "../src/index";
import type { QuerySpec } from "../src/index";

const q = createQuery({
  fields: {
    id: numberField(),
    name: stringField(),
    price: numberField(),
    category: enumField(["phone", "laptop"]),
    createdAt: dateField(),
    active: booleanField(),
    secret: stringField({ sortable: false, filterable: false }),
    rank: customField({ comparator: (a: number, b: number) => a - b }),
  },
  stableBy: "id",
});

it("field names are inferred as literals from the schema", () => {
  // @ts-expect-error typo'd field name is a compile error
  q.sort("pricee");
  // @ts-expect-error non-sortable fields are excluded from sort
  q.sort("secret");
  // @ts-expect-error non-filterable fields are excluded from filter
  q.filter("secret", "eq", "x");
  q.sort("price", "desc", { nulls: "last" });
});

it("operator/value pairs are checked at the type level", () => {
  // @ts-expect-error between requires a [T, T] tuple
  q.filter("price", "between", 5);
  q.filter("price", "between", [1, 2]);
  // @ts-expect-error in requires a T[] array
  q.filter("price", "in", 5);
  q.filter("price", "in", [1, 2, 3]);
  // @ts-expect-error isNull accepts no value parameter
  q.filter("createdAt", "isNull", true);
  q.filter("createdAt", "isNull");
  // @ts-expect-error string operators need string-valued kinds
  q.filter("price", "contains", "5");
  q.filter("name", "contains", "5");
  q.filter("category", "startsWith", "pho");
});

it("enumField narrows values to the literal union", () => {
  // @ts-expect-error not a member of the enum
  q.filter("category", "eq", "tablet");
  q.filter("category", "eq", "phone");
  // @ts-expect-error list members are checked too
  q.filter("category", "in", ["phone", "desk"]);
});

it("custom fields are null-checks-only in v0.1", () => {
  // @ts-expect-error valued operators are not available on custom fields
  q.filter("rank", "eq", 5);
  q.filter("rank", "isNull");
  q.sort("rank");
});

it("builder output is a QuerySpec", () => {
  expectTypeOf(q.toSpec()).toMatchTypeOf<QuerySpec>();
  expectTypeOf(q.apply([{ id: 1 }])).toEqualTypeOf<{ id: number }[]>();
});
