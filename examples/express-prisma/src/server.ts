/**
 * Backend example: parse → validate → generate (Express + Prisma-shaped args).
 *
 * The inbound boundary is one call: `products.parse(queryString)`. Everything
 * that comes back ok is schema-checked, guard-limited and injection-safe by
 * construction; everything else is a ready-made 400 body.
 *
 * The spec → Prisma mapping below is written by hand on purpose: it is the
 * exact seam the official `toPrisma` adapter replaces in v0.2 (ADR-0004).
 */
import express from "express";
import {
  createQuery,
  dateField,
  enumField,
  isErr,
  numberField,
  stringField,
  type FilterCondition,
  type QuerySpec,
} from "querypipe";

const products = createQuery({
  fields: {
    id: numberField(),
    name: stringField(),
    price: numberField(),
    stock: numberField(),
    category: enumField(["phone", "laptop", "tablet"]),
    createdAt: dateField({ alias: "created" }),
    deletedAt: dateField(),
    costPrice: numberField({ filterable: false, sortable: false }), // never reachable from the wire
  },
  stableBy: "id",
  guards: { maxSortColumns: 3, maxFilters: 10, maxInItems: 50 },
});

/* ---------------------------------------------------------------- *
 * Manual spec → Prisma findMany args (replaced by toPrisma in v0.2)
 * ---------------------------------------------------------------- */

type PrismaFindManyArgs = {
  where: Record<string, unknown>;
  orderBy: Array<Record<string, "asc" | "desc" | { sort: "asc" | "desc"; nulls: "first" | "last" }>>;
  skip?: number;
  take?: number;
};

const OP_TO_PRISMA: Record<string, (value: unknown) => unknown> = {
  eq: (v) => v,
  neq: (v) => ({ not: v }),
  gt: (v) => ({ gt: v }),
  gte: (v) => ({ gte: v }),
  lt: (v) => ({ lt: v }),
  lte: (v) => ({ lte: v }),
  in: (v) => ({ in: v }),
  notIn: (v) => ({ notIn: v }),
  between: (v) => {
    const [min, max] = v as [unknown, unknown];
    return { gte: min, lte: max };
  },
  contains: (v) => ({ contains: v }),
  startsWith: (v) => ({ startsWith: v }),
  endsWith: (v) => ({ endsWith: v }),
  isNull: () => null,
  notNull: () => ({ not: null }),
};

function toPrismaArgs(spec: QuerySpec): PrismaFindManyArgs {
  // v0.1 specs contain conditions only (root AND) — validated upstream.
  const conditions = spec.filters.filter((n): n is FilterCondition => n.kind === "condition");
  const where: Record<string, unknown[]> = { AND: [] };
  for (const c of conditions) {
    (where.AND as unknown[]).push({ [c.field]: OP_TO_PRISMA[c.op]!(c.value) });
  }

  const orderBy: PrismaFindManyArgs["orderBy"] = [...spec.sorts]
    .sort((a, b) => a.priority - b.priority)
    .map((s) => ({
      [s.field]: s.nulls ? { sort: s.direction, nulls: s.nulls } : s.direction,
    }));
  // Tie-breaker parity with client apply (ADR-0005) — the v0.2 adapter does this for you.
  if (orderBy.length > 0 && !spec.sorts.some((s) => s.field === "id")) {
    orderBy.push({ id: "asc" });
  }

  return {
    where,
    orderBy,
    ...(spec.offset !== undefined ? { skip: spec.offset } : {}),
    ...(spec.limit !== undefined ? { take: spec.limit } : {}),
  };
}

/* ---------------------------------------------------------------- *
 * HTTP wiring
 * ---------------------------------------------------------------- */

// Stand-in for `new PrismaClient()` — run `prisma generate` in a real app and
// replace this with the generated client; toPrismaArgs output is shaped for it.
const db = {
  product: {
    findMany: async (args: PrismaFindManyArgs): Promise<unknown[]> => {
      console.log("prisma.product.findMany", JSON.stringify(args, null, 2));
      return [];
    },
  },
};

const app = express();

app.get("/products", async (req, res) => {
  const queryString = req.originalUrl.split("?")[1] ?? "";
  const parsed = products.parse(queryString);

  if (isErr(parsed)) {
    // Structured, machine-readable 400 — no try/catch anywhere.
    res.status(400).json({ ok: false, errors: parsed.errors });
    return;
  }

  const rows = await db.product.findMany(toPrismaArgs(parsed.value));
  res.json({ ok: true, query: parsed.value, rows });
});

app.listen(3000, () => {
  console.log("try: http://localhost:3000/products?sort=price:desc,stock:asc&filter=price:between:1000,5000;category:in:phone,laptop;deletedAt:isNull&offset=30&limit=30");
});
