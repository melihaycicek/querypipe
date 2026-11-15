# Improvement backlog

Findings from a review of **querypipe v0.1.0** carried out on 2026-11-15: a full read of `packages/core`, the examples and the CI setup, plus a script that drove the built package with hostile and edge-case input. Every "observed" line below is real output from that script unless it says otherwise.

Nine findings were fixed in **v0.1.1**. Nine are still open, most of them because they need a design decision rather than code. The [roadmap](ROADMAP.md) covers planned features; this file covers gaps in what already shipped.

| # | Finding | Status |
| - | ------- | ------ |
| 1 | `limit` could not be capped | Fixed in 0.1.1 (opt-in `maxLimit`) — default still open, see [A](#a-make-the-page-size-cap-the-default) |
| 2 | Error output scaled with input size | Fixed in 0.1.1 |
| 3 | Integers beyond 2^53 − 1 silently rounded | Fixed in 0.1.1 |
| 4 | Impossible calendar days accepted (`2024-02-31`) | Fixed in 0.1.1 |
| 5 | Wrong error code for `constructor` / `__proto__` on the JSON path | Fixed in 0.1.1 |
| 6 | No way to remove a filter in the builder | Fixed in 0.1.1 |
| 7 | README showed `toPrismaArgs` as if it were exported | Fixed in 0.1.1 |
| 8 | `pnpm check` did not run publint / attw / size gate, though the docs said so | Fixed in 0.1.1 |
| 9 | Example "In stock only" button stacked duplicate filters | Fixed in 0.1.1 |
| A | Page-size cap is opt-in, not the default | Open — decision |
| B | Canonical string is not safe to drop into a URL | Open — decision |
| C | Unknown query parameters fail the whole parse | Open — decision |
| D | Builder can emit a query its own schema rejects | Open — documented trade-off, mitigation possible |
| E | Identical filter conditions are not de-duplicated | Open — decision |
| F | Substring operators ignore the field's collation | Open — decision |
| G | Date edge cases: three spellings of one instant, `T24:00:00Z` | Open — decision |
| H | Plain decimals below 1e-6 are rejected | Open — small |
| I | CI and release tooling gaps | Open — tooling |

## Fixed in v0.1.1

Decision record: [ADR-0012](adr/0012-boundary-hardening.md). Conformance vectors: `18-dates`, `20-validate-spec`, `21-numeric-safety`, `22-limit-guard`, `23-error-cap`.

1. **`maxLimit` guard.** v0.1.0 accepted `limit=9007199254740991` and the Express example passed it straight to Prisma's `take`. `guards: { maxLimit: 100 }` now rejects a larger limit with `VALUE_TOO_LONG`, `field: "limit"`. The guard is opt-in so the patch release rejects nothing v0.1.0 accepted.
2. **Bounded errors.** 16 KB of junk (`"a&"` × 8000) produced 8 001 errors and a 618 KB JSON body; an unknown 5 000-character field name was echoed back whole. Now: 50 errors and 3.7 KB for the same input (`maxErrors`, default 50), and echoed tokens stop at 64 characters + `…`.
3. **Safe integers only.** `filter=id:eq:9007199254740993` parsed to `…992` — a different row. Values with `|n| > 2^53 − 1` are now `INVALID_VALUE` on both ingress paths and a `TypeError` in the builder. Use `stringField()` for snowflake / `BIGINT` identifiers.
4. **Real calendar dates.** `2024-02-31`, `2023-02-29` and `2024-04-31T10:00:00Z` were accepted because `Date.parse` rolls the day over. The engine now checks month lengths itself.
5. **Declared fields only.** `validateQuerySpec` reported `NOT_FILTERABLE` for `field: "constructor"` and `"__proto__"` because the field table was a plain object. It is now prototype-less; the answer is `UNKNOWN_FIELD` on every path. The request was already rejected before — only the code was wrong.
6. **`removeFilter(field, op?)`, `clearFilters()`, `clearSorts()`.** Sorting had `removeSort`; filtering had nothing, so a filter UI had to rebuild the query from scratch.
7. **README.** The server snippet now says `toPrismaArgs` is a mapper you copy from the example, and parses the raw query string instead of `req.query.q`.
8. **`pnpm check`** now runs what README and CONTRIBUTING always claimed: build, typecheck, contract, tests, publint, attw and the size gate.
9. **`examples/react-table`.** The "In stock only" button appended `stock:gt:0` on every click and nothing could remove it. It is now a checkbox that toggles the condition.

Cost: +261 B min+gzip (7 536 → 7 797 B of the 8 192 B budget).

## Open

### A. Make the page-size cap the default

**Observed:** with no `guards.maxLimit`, `limit=9007199254740991` still parses, and a query with no `limit` at all reaches the database unbounded.

**Why it matters:** ADR-0006 promises that "a default-configured backend endpoint is safe to expose directly". For page size that is not yet true.

**Suggested:** in the next minor, give `maxLimit` a finite default. 1000 would leave the suite intact: outside `22-limit-guard.json` no vector asks for more than 30, and the property tests stop at 500. One unit test in `builder.test.ts` pins the uncapped default and would flip. Separately, the v0.2 adapters should take a `defaultLimit` and apply it at execution time; it must not be injected at parse time, because that would add a segment to `stringify(parse(x))` and break the round-trip laws.

**Decision needed:** the default value, and whether a changed default is acceptable in a `0.x` minor.

### B. The canonical string is not safe to drop into a URL

**Observed:** `stringify` escapes only `% , ; : & =`.

```
products.filter("name", "contains", "c# a+b").stringify()
→ filter=name:contains:c# a+b
```

- Put that after `?` and the browser treats `#` as the fragment: for `?filter=name:eq:c#sharp&limit=5` the server receives `filter=name:eq:c` and `limit` is gone. The request still succeeds — with a different query.
- `new URL(...).searchParams.get("filter")` turns `a+b` into `a b`, because `URLSearchParams` uses form decoding and the grammar treats `+` as a literal.

The spec says transports must handle this ("Transports that encode space as `+` must decode first"). Wrapping the whole string in one parameter (`?q=<encodeURIComponent(canonical)>`) avoids both problems, and `examples/react-table` does the equivalent through nuqs. The Express example does not wrap — it parses `req.originalUrl.split("?")[1]` — so it is exposed to the `#` case whenever a client builds the URL by concatenation.

**Suggested:** ship the safe path instead of documenting the unsafe one. Either `toSearchParams()` / `fromSearchParams()` helpers, or a `stringify({ urlSafe: true })` mode that also escapes `#`, space, `+` and non-ASCII. The second is wire-compatible today: the decoder already accepts any `%XX`, so URL-safe output parses with v0.1.0.

**Decision needed:** helper API vs. encoder option, and whether URL-safe should become the canonical form (that would change canonical bytes, so it is a major-version question).

### C. Unknown query parameters fail the whole parse

**Observed:** `sort=price&utm_source=x&page=2` → two `UNKNOWN_FIELD` errors, so the request is a 400.

This is normative (query-string spec, "unknown segment key ⇒ `UNKNOWN_FIELD`") and right for a dedicated `q=` parameter. It is awkward when the canonical string *is* the query string, because marketing tags, cache busters and the application's own parameters share that namespace.

**Suggested:** a parse option such as `{ unknownSegments: "ignore" }`, default unchanged. The `page=` case is already planned as a dialect (ADR-0010).

### D. The builder can emit a query its own schema rejects

**Observed:** with default guards, four `thenSort` calls stringify to `sort=price:asc,name:asc,stock:asc,category:asc`; parsing that with the same schema returns `MAX_SORT_EXCEEDED`. The same holds for an eleventh filter or a 300-character value.

This is a recorded decision, not a bug: ADR-0002 §7 and ADR-0006 §3 say guards bind at parse/validate only, and local code may check with `validateQuerySpec` first. The cost shows up in UIs — a table that lets a user shift-click a fourth column sends a request that fails. In `examples/react-table` the nuqs serializer turns a spec that fails `withSpec` into an empty string, so by reading the code the fourth column would reset the URL instead of reporting anything (not exercised in a browser).

**Suggested:** keep the decision, lower the cost. A one-line recipe in the docs (`validateQuerySpec(q, q.toSpec())` before sending), or a `q.check(): QueryResult<Query>` sugar for it. Throwing from the builder would contradict ADR-0002 and is not proposed.

### E. Identical filter conditions are not de-duplicated

**Observed:** `.filter("stock","gt",0).filter("stock","gt",0)` → `filter=stock:gt:0;stock:gt:0`. Both count against `maxFilters`.

`removeFilter` makes this avoidable but not impossible. De-duplicating in `filter()` would be cheap; whether `filter()` should stay a pure append is a semantics question, and it interacts with v0.3 groups, where the same condition may legitimately appear in two branches.

### F. Substring operators ignore the field's collation

**Observed:** on `stringField({ locale: "en", sensitivity: "base" })`, `eq "aria 12"` matches the row `"Aria 12"` and `contains "aria"` does not. `contains` / `startsWith` / `endsWith` always compare code units.

**Why it matters:** search boxes are the main use of `contains`, and users expect them to ignore case. Databases disagree with each other here (PostgreSQL `LIKE` is case-sensitive; MySQL and SQLite usually are not, depending on collation), so client `apply` and a server adapter can return different rows for the same spec — the equivalence ADR-0004 asks adapters to keep.

**Decision needed:** either define substring matching under a collation, or add explicit case-insensitive operators. A new operator is a wire-format change and has to be weighed against Java portability first.

### G. Date edge cases

- **Three canonical strings for one instant.** `2024-01-01`, `2024-01-01T00:00:00Z` and `2024-01-01T02:00:00+02:00` compare equal in `apply` but canonicalize to three different strings. This is deliberate — vector `roundtrip-date-values-kept-as-given` pins it — but it means the canonical string is a weaker cache key for date filters than the README suggests. Normalizing to UTC would change canonical bytes.
- **`T24:00:00Z` is accepted**, because `Date.parse` allows it as end-of-day. Not checked against `java.time`; worth a vector either way before the Java port starts.

### H. Plain decimals below 1e-6 are rejected

**Observed:** `filter=price:eq:0.0000001` → `INVALID_VALUE`. The token matches the number grammar, but JavaScript renders the value as `1e-7` and the no-exponent rule then rejects it. Fix by rendering small numbers in positional notation in `stringify` and accepting them in `isCanonicalNumber`; needs a vector for the exact digits to stay Java-identical.

### I. CI and release tooling

- **Node matrix.** `engines` says `>= 18.17`; CI runs Node 20 only. Not changed in v0.1.1 because the website's `postinstall` (`fumadocs-mdx`) runs during `pnpm install` and may not support Node 18 — a matrix needs a filtered install for the package jobs, and that could not be verified without a CI run.
- **Website and examples are outside CI.** Root scripts filter to `querypipe` and `@querypipe/*`, so `apps/website` (typecheck, build, `typecheck:snippets`) and both examples can break unnoticed. v0.1.1 touched all three and they were checked by hand: website typecheck and build pass, all 33 docs snippets compile, `express-prisma` typechecks.
- **`examples/react-table` does not typecheck — and did not before v0.1.1.** `tsc --noEmit` reports three errors (two `flexRender` results and `NuqsAdapter` "cannot be used as a JSX component"). The workspace installs both `@types/react` 18 (this example) and 19 (the website); a mismatch between the two is the likely cause, and moving the example to React 19 is the first thing to try. It has to be fixed before the examples can join CI.
- **`pnpm changeset` crashes on Node 20.11** with `ERR_REQUIRE_ESM` (`@changesets/write` requires the ESM-only `human-id@4.2.0`). The v0.1.1 version bump and changelog were therefore written by hand in the format changesets produces. Node versions that can `require()` ES modules should not hit this (not tried); pinning the Node version in `.nvmrc` / `engines` for development would make it explicit.
- **No linter or formatter** is configured anywhere in the repository.
- **No release workflow.** Publishing is `pnpm release` from a laptop, with `provenance: false`. A changesets GitHub Action with npm provenance would make releases reproducible.
- **Bundle headroom is ~400 B.** The next feature in core will hit the 8 KiB gate; the shrink candidates in ADR-0003 (strip messages to codes at build time, split `apply` from the parse boundary) are worth doing first.
- **`apps/website` newsletter endpoint** rate-limits per instance, in memory, keyed on the first `x-forwarded-for` hop. On serverless that is close to no limit. The code comments call it naive on purpose; fine until the endpoint is abused.

## Suggested order

A and B first — they are the two places where a default setup can run a query the caller did not intend. Then I (CI coverage), since v0.1.1 already had to verify the website and examples by hand. C, D and E are ergonomics; F and G need the Java-portability discussion before any code.
