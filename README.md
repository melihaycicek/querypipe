<div align="center">

# querypipe

**A typed query behavior engine for filtering, progressive multi-sorting, pagination and backend-safe query generation.**

[![npm version](https://img.shields.io/npm/v/querypipe?color=%230b7285)](https://www.npmjs.com/package/querypipe)
[![CI](https://github.com/melihaycicek/querypipe/actions/workflows/ci.yml/badge.svg)](https://github.com/melihaycicek/querypipe/actions/workflows/ci.yml)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/querypipe?label=min%2Bgzip)](https://bundlephobia.com/package/querypipe)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/querypipe?activeTab=dependencies)
[![types](https://img.shields.io/npm/types/querypipe)](https://www.npmjs.com/package/querypipe)
[![license](https://img.shields.io/npm/l/querypipe?color=blue)](./LICENSE)

</div>

---

querypipe manages the **contract** applied to your data — a single type-safe `QuerySpec` for filters, progressive (additive) multi-sort, and pagination — never the data itself.

It is **not** a UI library, **not** an ORM, and **not** a state manager. It doesn't compete with [nuqs](https://nuqs.47ng.com/) (URL state), [TanStack Table](https://tanstack.com/table) (UI state) or [api-query-params](https://github.com/loris/api-query-params) (Mongo parsing) — **it's the bridge between them.** One schema, one spec, one canonical wire format shared by client and server (and, soon, by the `querypipe-java` port — the spec and JSON wire format are language-independent by design).

```
   URL / UI state                 querypipe                    Backend
 ┌────────────────┐    parse    ┌────────────┐   generate   ┌──────────────┐
 │  ?sort=price…  │ ─────────▶  │  QuerySpec │  ──────────▶ │ ORDER BY /   │
 │  TanStack sort │ ◀───────── │  (typed,   │  ◀────────── │ Prisma / SQL │
 │  nuqs params   │  stringify  │  frozen)   │   validate   │ (param-safe) │
 └────────────────┘             └────────────┘              └──────────────┘
                                      │ apply
                                      ▼
                             client-side rows (stable,
                             SQL ORDER BY-equivalent)
```

## Why querypipe

- 🧷 **Type-safe end to end.** Field names are literal types inferred from the schema (`sort("pricee")` is a *compile* error); operator/value pairs are checked at the type level (`between` wants `[T, T]`, `isNull` accepts no value); `enumField` narrows values to a union.
- 🔀 **Progressive sorting as a first-class semantic.** `sort` resets, `thenSort` appends **without disturbing** prior priorities, `insertSortAfter` / `removeSort` / `toggleSortDirection` edit the chain in place; priorities renormalize to `1..n` on every step. This is the "shift-click a second column header to refine the order" behavior, modeled properly.
- 🛡️ **Backend-safe by default.** A mandatory field whitelist (there is **no** schema-less parse), guard limits (sort columns, filter count, value length, `IN` size), no user input ever reaching a `RegExp`/pattern, and a structured **multi-error** `Result` — parse and validate **never throw**.
- 🎯 **Deterministic.** Canonical, byte-stable `stringify`; stable sort with an automatically injected unique tie-breaker; a fixed SQL `ORDER BY` reference model (PostgreSQL NULL semantics) shared by client `apply` and future adapters.
- 🪶 **Tiny & dependency-free.** Zero runtime dependencies, ESM + CJS, fully tree-shakable, ≈ 7.4 kB min+gzip. Optional per-field value validation via the dependency-free [Standard Schema](https://standardschema.dev) interface (Zod / Valibot / ArkType plug in with no coupling).

## Install

```sh
npm install querypipe
# or: pnpm add querypipe · yarn add querypipe · bun add querypipe
```

Requires Node ≥ 18.17 (or any modern browser/runtime). Ships ESM + CJS with correct `types` for both.

## 60-second tour

### 1. Describe the contract once

```ts
import { createQuery, numberField, stringField, dateField, enumField, isOk } from "querypipe";

const products = createQuery({
  fields: {
    id: numberField(),
    name: stringField(),
    price: numberField(),
    category: enumField(["phone", "laptop", "tablet"]),
    deletedAt: dateField(),
    costPrice: numberField({ filterable: false, sortable: false }), // unreachable from the wire
  },
  stableBy: "id",                    // deterministic tie-breaker, injected at execution time
  guards: { maxSortColumns: 3 },     // backend-safe by default
});
```

### 2. Build queries fluently and immutably (client)

```ts
const q = products
  .filter("price", "between", [1000, 5000])
  .filter("deletedAt", "isNull")
  .sort("price", "desc")
  .thenSort("name");                 // refines, never destroys, the existing order

q.stringify();
// "sort=price:desc,name:asc&filter=price:between:1000,5000;deletedAt:isNull"

q.apply(rows);                       // non-mutating, stable, SQL ORDER BY-equivalent
```

Every builder method returns a **new** frozen query — undo/redo, `diff` and history (v0.2) come for free on top of it.

### 3. Accept untrusted input safely (server)

```ts
const parsed = products.parse(req.query.q ?? "");
if (!isOk(parsed)) {
  return res.status(400).json({ errors: parsed.errors });  // structured, machine-readable, all at once
}
// parsed.value is whitelisted, guard-limited, injection-safe by construction
const rows = await db.product.findMany(toPrismaArgs(parsed.value));
```

## Feature walkthrough

<details open>
<summary><b>Progressive (additive) multi-sort</b></summary>

```ts
let q = products.sort("category");        // priority 1
q = q.thenSort("price", "desc");          // append → priority 2, category untouched
q = q.insertSortAfter("category", "name");// name slots in at priority 2, price → 3
q = q.toggleSortDirection("price");       // flip in place, keep its priority
q = q.removeSort("name");                 // drop it, renormalize to 1..n
```

`thenSort` is guaranteed never to change the `(field, direction, priority)` of any pre-existing sort — a property the conformance suite enforces.
</details>

<details>
<summary><b>Filter operators (MVP set)</b></summary>

`eq` `neq` `gt` `gte` `lt` `lte` `in` `notIn` `between` `contains` `startsWith` `endsWith` `isNull` `notNull`, combined with root-level `AND`. `contains`/`startsWith`/`endsWith` are always literal — user input never becomes a pattern language. `isNull`/`notNull` take no value (enforced by types *and* runtime). OR groups arrive in v0.3 as a pure API unlock — the `FilterGroup` type and wire format already ship in v0.1, so **nothing about the spec shape changes**.
</details>

<details>
<summary><b>Canonical string ⇄ spec, losslessly</b></summary>

```ts
products.parse("offset=30&filter=deletedAt:isNull&sort=price"); // lenient in…
// → canonical out, byte-stable:
//   "sort=price:asc&filter=deletedAt:isNull&offset=30"
```

Values containing the grammar's own separators round-trip losslessly via a 6-character percent-encode set (`% , ; : & =`). `stringify(parse(x))` is idempotent — perfect for cache keys and ETags.
</details>

<details>
<summary><b>Structured errors, never thrown on the data path</b></summary>

```ts
const r = products.parse("sort=secret:asc,nope:asc&filter=price:like:5");
// r.errors === [
//   { code: "NOT_SORTABLE",     field: "secret", position: 5 },
//   { code: "UNKNOWN_FIELD",    field: "nope",   position: 17 },
//   { code: "INVALID_OPERATOR", field: "price", op: "like", position: 40 },
// ]
```

Closed error-code set: `UNKNOWN_FIELD` · `NOT_SORTABLE` · `NOT_FILTERABLE` · `INVALID_OPERATOR` · `INVALID_VALUE` · `MAX_SORT_EXCEEDED` · `MAX_FILTER_EXCEEDED` · `VALUE_TOO_LONG` · `CONFLICTING_PAGINATION`. Schema/builder *misuse* throws `TypeError` (a bug), data errors return `Result` (input) — the line is mechanical.
</details>

<details>
<summary><b>Optional value validation (Standard Schema, zero coupling)</b></summary>

```ts
import { z } from "zod";
const users = createQuery({
  fields: { email: stringField({ schema: z.string().email() }) },
});
// z / valibot / arktype all plug in via the ~standard interface — no runtime dependency added.
```
</details>

## Positioning: the bridge, not a competitor

| Concern | Owned by | querypipe's role |
| --- | --- | --- |
| URL state persistence | nuqs, `URLSearchParams` | Produces/consumes the **canonical query string** they store |
| Table UI state | TanStack Table | Two-way adapter (v0.2): table state ⇄ the same `QuerySpec` |
| Mongo query parsing | api-query-params | Compat dialect (v0.2): parse their syntax → canonical spec |
| ORM execution | Prisma, Drizzle, raw SQL | Adapters (v0.2): `QuerySpec` → param-safe `where`/`orderBy` |
| **The query *contract*** | — | **querypipe** — one typed spec everyone agrees on |

## Public API

**Runtime:** `createQuery` · `numberField` `stringField` `dateField` `booleanField` `enumField` `customField` · `parseQuery` `stringifyQuery` `validateQuerySpec` `canonicalize` `applyQuery` · `isOk` `isErr`

**Types:** `QuerySpec` `SortCondition` `FilterNode` `FilterCondition` `FilterGroup` `Operator` `QueryError` `QueryErrorCode` `FieldSchema` `QueryResult`

The full frozen surface (implementation-free, CI-typechecked) lives at [`docs/api/public-api.d.ts`](docs/api/public-api.d.ts). Methods are also available fluently on a query instance (`q.parse`, `q.stringify`, `q.apply`, `q.withSpec`, `q.toSpec`).

## Packages

| Package | Contents |
| --- | --- |
| [`querypipe`](packages/core) | The primary published package. Field schema DSL, immutable builder, parse/stringify/canonicalize, validate, client-side `apply`. Zero dependencies. |
| [`@querypipe/testing`](packages/testing) | Language-independent JSON conformance vectors (written **before** the implementation — they are the contract), the vector runner seam, an independent `ORDER BY` reference model, fast-check invariant properties. Private in v0.1; the scoped name is reserved. |

**Examples:** [`examples/react-table`](examples/react-table) (TanStack Table + nuqs, manual wiring) · [`examples/express-prisma`](examples/express-prisma) (parse → validate → Prisma args).

## Design & documentation

Every architectural decision is recorded as an ADR — read them to understand *why* the spec looks the way it does:

- 📐 [Architecture Decision Records](docs/adr/README.md) — 11 ADRs (wire format & discriminated filter AST, immutability, error model, adapter contract, tie-breaker, guards, escaping/canonicalization, NULL semantics, Standard Schema, dialect plugins, Java portability)
- 📜 Normative specs: [query-string grammar](docs/spec/query-string.md) · [JSON wire format](docs/spec/wire-format.md) · [conformance test-vector format](docs/spec/test-vectors.md)
- 🗺️ [**Roadmap & quarterly plan**](docs/ROADMAP.md) — what's reserved, what's next, and the exit criteria for each release

Design priority order on any trade-off: **Java portability → type safety → bundle size → API ergonomics.**

## Roadmap at a glance

| Release | Theme | Highlights |
| --- | --- | --- |
| **v0.1** ✅ | The contract | Core engine + conformance suite (this release) |
| **v0.2** | Generate & interop | Adapters (`@querypipe/prisma` · `@querypipe/sql` · `@querypipe/mongo` · two-way `@querypipe/tanstack`), syntax dialects (JSON:API, OData, `page=`), keyset/cursor pagination, spec versioning & `migrate`, computed & nested fields, `diff`/`merge`/history |
| **v0.3** | OR groups | `orGroup(...)` builder — a pure API unlock (type & wire format already ship in v0.1) |
| **querypipe-java** | Cross-language | Same spec, same JSON vectors, JPA/JDBC adapters |

Full quarter-by-quarter detail with exit criteria: **[docs/ROADMAP.md](docs/ROADMAP.md).** Interface stubs for v0.2 already live in [`docs/api/adapter-v0.2.d.ts`](docs/api/adapter-v0.2.d.ts) and [`docs/api/dialect-v0.2.d.ts`](docs/api/dialect-v0.2.d.ts).

## Development

```sh
pnpm install
pnpm build        # tsup → ESM + CJS + .d.ts
pnpm test         # vitest: unit + 20 conformance vector files + fast-check invariants
pnpm typecheck
pnpm check        # everything CI runs (build, typecheck, tests, publint, attw, size gate)
```

The conformance suite is the source of truth: vectors are written *before* the implementation, and the same JSON files will be the acceptance suite for `querypipe-java`. See [CONTRIBUTING](CONTRIBUTING.md).

## License

[MIT](LICENSE) © querypipe contributors
