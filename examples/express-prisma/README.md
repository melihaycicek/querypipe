# express-prisma example — parse → validate → orderBy

A backend endpoint whose entire inbound query handling is `products.parse(queryString)`: schema whitelisting, guard limits, structured 400s and a hand-written spec → Prisma `findMany` args mapping (the seam the official `toPrisma` adapter replaces in v0.2, tie-breaker injection included).

```sh
pnpm install
pnpm --filter express-prisma-example dev
# then:
curl "http://localhost:3000/products?sort=price:desc&filter=category:in:phone,laptop&limit=10"
curl "http://localhost:3000/products?sort=secret:asc"   # → 400 UNKNOWN_FIELD
```

The Prisma client is stubbed so the example runs without a database; swap in a generated `PrismaClient` and the args shape lines up.
