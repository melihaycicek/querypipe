import { describe, expect, it } from "vitest";
import {
  createQuery,
  customField,
  dateField,
  enumField,
  isErr,
  isOk,
  numberField,
  stringField,
} from "../src/index";

const products = () =>
  createQuery({
    fields: {
      id: numberField(),
      price: numberField(),
      stock: numberField(),
      name: stringField(),
      category: enumField(["phone", "laptop", "tablet"]),
      createdAt: dateField(),
      secret: stringField({ sortable: false, filterable: false }),
    },
    stableBy: "id",
  });

describe("progressive sort semantics (ADR-0002 §2)", () => {
  it("sort resets the chain; thenSort appends with the next priority", () => {
    const q = products().sort("price", "desc").thenSort("stock").thenSort("name", "desc");
    expect(q.toSpec().sorts).toEqual([
      { field: "price", direction: "desc", priority: 1 },
      { field: "stock", direction: "asc", priority: 2 },
      { field: "name", direction: "desc", priority: 3 },
    ]);
    expect(q.sort("name").toSpec().sorts).toEqual([
      { field: "name", direction: "asc", priority: 1 },
    ]);
  });

  it("thenSort on an existing field updates in place and keeps its priority", () => {
    const q = products().sort("price").thenSort("stock").thenSort("price", "desc");
    expect(q.toSpec().sorts).toEqual([
      { field: "price", direction: "desc", priority: 1 },
      { field: "stock", direction: "asc", priority: 2 },
    ]);
  });

  it("insertSortAfter moves/inserts right after the anchor and renormalizes", () => {
    const q = products().sort("price").thenSort("stock").insertSortAfter("price", "name");
    expect(q.toSpec().sorts.map((s) => [s.field, s.priority])).toEqual([
      ["price", 1],
      ["name", 2],
      ["stock", 3],
    ]);
    // absent anchor appends
    const q2 = products().sort("price").insertSortAfter("stock", "name");
    expect(q2.toSpec().sorts.map((s) => s.field)).toEqual(["price", "name"]);
  });

  it("removeSort renormalizes to 1..n; toggle flips direction in place", () => {
    const q = products().sort("price").thenSort("stock").thenSort("name");
    expect(q.removeSort("stock").toSpec().sorts).toEqual([
      { field: "price", direction: "asc", priority: 1 },
      { field: "name", direction: "asc", priority: 2 },
    ]);
    expect(q.toggleSortDirection("stock").toSpec().sorts[1]).toEqual({
      field: "stock",
      direction: "desc",
      priority: 2,
    });
    // absent field: no-op, same instance
    expect(q.toggleSortDirection("createdAt")).toBe(q);
    expect(q.removeSort("createdAt")).toBe(q);
  });
});

describe("filter and sort removal (ADR-0012 §6)", () => {
  it("removeFilter drops every condition on the field, or only the given operator", () => {
    const q = products()
      .filter("price", "gt", 10)
      .filter("stock", "gt", 0)
      .filter("price", "lt", 500)
      .sort("name")
      .limit(20);
    expect(q.removeFilter("price").stringify()).toBe("sort=name:asc&filter=stock:gt:0&limit=20");
    expect(q.removeFilter("price", "lt").stringify()).toBe(
      "sort=name:asc&filter=price:gt:10;stock:gt:0&limit=20",
    );
    expect(Object.isFrozen(q.removeFilter("price").toSpec().filters)).toBe(true);
  });

  it("removeFilter + filter replaces a condition instead of stacking duplicates", () => {
    const toggle = (q: ReturnType<typeof products>) =>
      q.toSpec().filters.length > 0 ? q.removeFilter("stock", "gt") : q.filter("stock", "gt", 0);
    const on = toggle(products());
    expect(on.stringify()).toBe("filter=stock:gt:0");
    expect(toggle(on).stringify()).toBe("");
    expect(on.removeFilter("stock").filter("stock", "gt", 5).stringify()).toBe("filter=stock:gt:5");
  });

  it("nothing to remove is a no-op that returns the same instance", () => {
    const q = products().filter("price", "gt", 10);
    expect(q.removeFilter("stock")).toBe(q);
    expect(q.removeFilter("price", "lt")).toBe(q);
    expect(products().clearFilters().toSpec()).toBe(products().toSpec());
    const empty = products();
    expect(empty.clearFilters()).toBe(empty);
    expect(empty.clearSorts()).toBe(empty);
  });

  it("clearFilters and clearSorts empty one dimension and leave the rest alone", () => {
    const q = products().filter("price", "gt", 10).sort("price").thenSort("name").offset(40);
    expect(q.clearFilters().stringify()).toBe("sort=price:asc,name:asc&offset=40");
    expect(q.clearSorts().stringify()).toBe("filter=price:gt:10&offset=40");
    expect(q.stringify()).toBe("sort=price:asc,name:asc&filter=price:gt:10&offset=40");
  });

  it("removeFilter misuse throws TypeError", () => {
    const loose = products() as unknown as { removeFilter: (...args: unknown[]) => unknown };
    expect(() => loose.removeFilter("nope")).toThrow(TypeError);
    expect(() => loose.removeFilter("price", "like")).toThrow(TypeError);
    expect(() => loose.removeFilter("constructor")).toThrow(TypeError);
  });
});

describe("boundary hardening (ADR-0012; not vector-expressible parts)", () => {
  it("names inherited from Object.prototype are unknown fields everywhere", () => {
    const q = products();
    expect(() => q.sort("constructor" as never)).toThrow(/unknown field/);
    expect(() => q.sort("__proto__" as never)).toThrow(/unknown field/);
    const parsed = q.parse("sort=toString&filter=hasOwnProperty:isNull");
    if (!isErr(parsed)) throw new Error("expected errors");
    expect(parsed.errors.map((e) => e.code)).toEqual(["UNKNOWN_FIELD", "UNKNOWN_FIELD"]);
  });

  it("a field literally named __proto__ is an ordinary field", () => {
    const fields = JSON.parse('{"id":{"type":"number"},"__proto__":{"type":"number"}}');
    const q = createQuery({ fields } as never);
    expect(isOk(q.parse("sort=__proto__"))).toBe(true);
    expect(isErr(q.parse("sort=type"))).toBe(true);
  });

  it("builder rejects numbers and dates the wire could not carry exactly", () => {
    const q = products();
    expect(() => q.filter("id", "eq", 2 ** 53)).toThrow(TypeError);
    expect(q.filter("id", "eq", Number.MAX_SAFE_INTEGER).stringify()).toBe(
      "filter=id:eq:9007199254740991",
    );
    expect(() => q.filter("createdAt", "eq", "2024-02-31")).toThrow(TypeError);
    expect(q.filter("createdAt", "eq", "2024-02-29").stringify()).toBe(
      "filter=createdAt:eq:2024-02-29",
    );
  });

  it("guard options are validated at construction; maxLimit defaults to uncapped", () => {
    expect(() => createQuery({ fields: { a: numberField() }, guards: { maxLimit: 0 } })).toThrow(TypeError);
    expect(() => createQuery({ fields: { a: numberField() }, guards: { maxErrors: 1.5 } })).toThrow(
      TypeError,
    );
    expect(isOk(products().parse("limit=9007199254740991"))).toBe(true);
  });

  it("the default error cap bounds hostile input; a raised cap restores full collection", () => {
    const junk = "a&".repeat(500);
    const capped = products().parse(junk);
    if (!isErr(capped)) throw new Error("expected errors");
    expect(capped.errors).toHaveLength(50);
    const wide = createQuery({ fields: { id: numberField() }, guards: { maxErrors: 1000 } }).parse(junk);
    if (!isErr(wide)) throw new Error("expected errors");
    expect(wide.errors).toHaveLength(501);
  });
});

describe("immutability (ADR-0002 §1)", () => {
  it("every mutation returns a new query and freezes its spec", () => {
    const base = products();
    const q1 = base.sort("price");
    const q2 = q1.filter("price", "gt", 100);
    expect(base.toSpec().sorts).toEqual([]);
    expect(q1.toSpec().filters).toEqual([]);
    expect(Object.isFrozen(q2.toSpec())).toBe(true);
    expect(Object.isFrozen(q2.toSpec().filters)).toBe(true);
    expect(Object.isFrozen(q2.toSpec().sorts)).toBe(true);
    expect(() => {
      (q2.toSpec().sorts as unknown as unknown[]).push(0);
    }).toThrow();
  });

  it("builder cursor/offset are mutually exclusive by construction", () => {
    const q = products().offset(10).cursor("abc");
    expect(q.toSpec().offset).toBeUndefined();
    expect(q.toSpec().cursor).toBe("abc");
    expect(q.offset(5).toSpec().cursor).toBeUndefined();
  });

  it("limit/offset clamp to non-negative integers", () => {
    expect(products().limit(2.9).toSpec().limit).toBe(2);
    expect(products().offset(-3).toSpec().offset).toBe(0);
  });
});

describe("error regimes (ADR-0003)", () => {
  it("builder misuse throws TypeError", () => {
    const q = products();
    // Plain-JS callers bypass the compile-time checks — simulate with a loose view.
    const loose = q as unknown as { filter: (...args: unknown[]) => unknown };
    expect(() => q.sort("nope" as never)).toThrow(TypeError);
    expect(() => q.sort("secret" as never)).toThrow(TypeError);
    expect(() => q.filter("price", "eq", "abc" as never)).toThrow(TypeError);
    expect(() => loose.filter("price", "isNull", true)).toThrow(TypeError);
    expect(() => q.filter("price", "between", [1] as never)).toThrow(TypeError);
    expect(() => q.filter("category", "eq", "desk" as never)).toThrow(TypeError);
    expect(() => q.cursor("")).toThrow(TypeError);
    expect(() => createQuery({ fields: { "bad name": numberField() } })).toThrow(TypeError);
    expect(() =>
      createQuery({ fields: { a: numberField({ alias: "x" }), b: numberField({ alias: "x" }) } }),
    ).toThrow(TypeError);
    expect(() =>
      createQuery({ fields: { a: numberField() }, stableBy: "b" as never }),
    ).toThrow(TypeError);
  });

  it("data-path methods return Results and never throw", () => {
    const q = products();
    const bad = q.parse("sort=nope:asc");
    expect(isErr(bad)).toBe(true);
    const good = q.parse("sort=price:desc");
    expect(isOk(good)).toBe(true);
    const rejected = q.withSpec({
      filters: [{ kind: "group", logic: "or", children: [] }],
      sorts: [],
    });
    expect(isErr(rejected)).toBe(true);
  });

  it("withSpec renormalizes priorities and returns a working builder", () => {
    const q = products();
    const result = q.withSpec({
      filters: [],
      sorts: [
        { field: "stock", direction: "asc", priority: 7 },
        { field: "price", direction: "desc", priority: 2 },
      ],
    });
    if (!isOk(result)) throw new Error("expected ok");
    expect(result.value.toSpec().sorts).toEqual([
      { field: "price", direction: "desc", priority: 1 },
      { field: "stock", direction: "asc", priority: 2 },
    ]);
    expect(result.value.stringify()).toBe("sort=price:desc,stock:asc");
  });
});

describe("value normalization at entry", () => {
  it("normalizes Date and epoch filter values to ISO strings (wire-ready specs)", () => {
    const q = products().filter("createdAt", "gt", new Date(Date.UTC(2024, 0, 15, 10)));
    expect(q.toSpec().filters[0]).toEqual({
      kind: "condition",
      field: "createdAt",
      op: "gt",
      value: "2024-01-15T10:00:00.000Z",
    });
    expect(q.stringify()).toBe("filter=createdAt:gt:2024-01-15T10%3A00%3A00.000Z");
  });
});

describe("custom fields and collated strings (not vector-expressible; ADR-0008)", () => {
  it("custom comparator drives sorting; NULL class never reaches it; valued ops throw", () => {
    const sizes = createQuery({
      fields: {
        id: numberField(),
        size: customField({
          comparator: (a: string, b: string) => "SML".indexOf(a) - "SML".indexOf(b),
        }),
      },
      stableBy: "id",
    });
    const rows = [
      { id: 1, size: "L" },
      { id: 2, size: null },
      { id: 3, size: "S" },
      { id: 4, size: "M" },
    ];
    expect(sizes.sort("size").apply(rows).map((r) => r.id)).toEqual([3, 4, 1, 2]);
    expect(sizes.filter("size", "isNull").apply(rows).map((r) => r.id)).toEqual([2]);
    // Valued operators on custom fields are compile-rejected; verify the runtime gate too.
    const loose = sizes as unknown as { filter: (...args: unknown[]) => unknown };
    expect(() => loose.filter("size", "eq", "S")).toThrow(TypeError);
  });

  it("locale collation is an opt-in; base sensitivity makes eq case-insensitive", () => {
    const people = createQuery({
      fields: { id: numberField(), name: stringField({ locale: "en", sensitivity: "base" }) },
      stableBy: "id",
    });
    const rows = [
      { id: 1, name: "ADA" },
      { id: 2, name: "berk" },
    ];
    expect(people.filter("name", "eq", "ada").apply(rows).map((r) => r.id)).toEqual([1]);
  });
});
