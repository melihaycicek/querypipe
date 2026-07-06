<div align="center">

# querypipe

**A typed query behavior engine for filtering, progressive multi-sorting, pagination and backend-safe query generation.**

[![npm version](https://img.shields.io/npm/v/querypipe?color=%230b7285)](https://www.npmjs.com/package/querypipe)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/querypipe?label=min%2Bgzip)](https://bundlephobia.com/package/querypipe)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/querypipe?activeTab=dependencies)
[![license](https://img.shields.io/npm/l/querypipe?color=blue)](https://github.com/melihaycicek/querypipe/blob/main/LICENSE)

</div>

querypipe manages the **contract** applied to your data — a single type-safe `QuerySpec` for filters, progressive (additive) multi-sort, and pagination — never the data itself. It's not a UI library, ORM, or state manager: **it's the bridge** between URL state (nuqs), table UI state (TanStack Table) and backend execution (Prisma/SQL/Mongo). One schema, one spec, one canonical wire format shared by client and server.

```sh
npm install querypipe
```

## Highlights

- 🧷 **Type-safe end to end** — field names inferred as literals (`sort("pricee")` is a compile error), operator/value pairs checked at the type level (`between` → `[T, T]`, `isNull` → no value), enums narrowed to unions.
- 🔀 **Progressive multi-sort** — `sort` resets, `thenSort` appends without disturbing prior priorities; the whole chain renormalizes to `1..n` on every edit.
- 🛡️ **Backend-safe by default** — mandatory field whitelist (no schema-less parse), guard limits, no user input reaching a `RegExp`, structured multi-error `Result` that **never throws** on the data path.
- 🎯 **Deterministic** — byte-stable canonical `stringify`, stable sort with an auto-injected unique tie-breaker, a fixed SQL `ORDER BY` reference model (PostgreSQL NULL semantics).
- 🪶 **≈ 7.4 kB min+gzip, zero dependencies**, ESM + CJS, tree-shakable. Optional per-field validation via [Standard Schema](https://standardschema.dev) (Zod/Valibot/ArkType — no coupling).

## Quick start

```ts
import { createQuery, numberField, stringField, dateField, enumField, isOk } from "querypipe";

const products = createQuery({
  fields: {
    id: numberField(),
    name: stringField(),
    price: numberField(),
    category: enumField(["phone", "laptop", "tablet"]),
    deletedAt: dateField(),
  },
  stableBy: "id",
  guards: { maxSortColumns: 3 },
});

// Client — immutable fluent builder, progressive sorting
const q = products
  .filter("price", "between", [1000, 5000])
  .filter("deletedAt", "isNull")
  .sort("price", "desc")
  .thenSort("name");

q.stringify();
// "sort=price:desc,name:asc&filter=price:between:1000,5000;deletedAt:isNull"
q.apply(rows);   // non-mutating, stable, SQL ORDER BY-equivalent

// Server — untrusted input, never throws
const parsed = products.parse(req.query.q ?? "");
if (!isOk(parsed)) return res.status(400).json({ errors: parsed.errors });
// parsed.value is whitelisted, guard-limited and injection-safe
```

## API

**Runtime:** `createQuery` · `numberField` `stringField` `dateField` `booleanField` `enumField` `customField` · `parseQuery` `stringifyQuery` `validateQuerySpec` `canonicalize` `applyQuery` · `isOk` `isErr`

**Types:** `QuerySpec` `SortCondition` `FilterNode` `FilterCondition` `FilterGroup` `Operator` `QueryError` `QueryErrorCode` `FieldSchema` `QueryResult`

Operators: `eq` `neq` `gt` `gte` `lt` `lte` `in` `notIn` `between` `contains` `startsWith` `endsWith` `isNull` `notNull`. Error codes: `UNKNOWN_FIELD` · `NOT_SORTABLE` · `NOT_FILTERABLE` · `INVALID_OPERATOR` · `INVALID_VALUE` · `MAX_SORT_EXCEEDED` · `MAX_FILTER_EXCEEDED` · `VALUE_TOO_LONG` · `CONFLICTING_PAGINATION`.

## Documentation

Full docs, architecture decision records, the normative wire-format/grammar specs, and the roadmap live in the repository:

**→ [github.com/melihaycicek/querypipe](https://github.com/melihaycicek/querypipe)**

- [Architecture Decision Records](https://github.com/melihaycicek/querypipe/tree/main/docs/adr) (11 ADRs)
- [Canonical query-string grammar](https://github.com/melihaycicek/querypipe/blob/main/docs/spec/query-string.md) · [JSON wire format](https://github.com/melihaycicek/querypipe/blob/main/docs/spec/wire-format.md)
- [Roadmap & quarterly plan](https://github.com/melihaycicek/querypipe/blob/main/docs/ROADMAP.md)

## License

[MIT](https://github.com/melihaycicek/querypipe/blob/main/LICENSE) © querypipe contributors
