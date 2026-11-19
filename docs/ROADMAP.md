# querypipe — Roadmap & Quarterly Plan

This roadmap turns the reserved-but-unimplemented surface (see the [ADRs](adr/README.md) and the `*-v0.2.d.ts` interface drafts) into a scheduled, quarter-by-quarter plan. It is intentionally concrete: each item names the ADR that already fixed its contract, so shipping it is *implementation*, not *design*.

**Guiding principle (unchanged across releases).** On any trade-off the priority order is: **(1) Java portability → (2) type safety → (3) bundle size → (4) API ergonomics.** Every feature must answer: *can this deserialize into a sealed Java type from the same JSON, and can both languages produce byte-identical canonical strings?*

**Versioning contract.** The `QuerySpec` shape and JSON wire format are frozen. New capabilities unlock *behavior*, not *shape*: OR groups, adapters, dialects and keyset pagination all fit the v0.1 type and wire format. A change that would alter the wire format is a major-version event and must be justified against priority (1).

**Legend:** ✅ done · 🚧 in progress · ⏳ planned · 🧊 reserved (interface exists, no work scheduled yet). Dates are targets, not commitments; scope is trimmed before dates slip.

---

## Now — v0.1.x · Q3 2026 (Jul–Sep) · Theme: *Stabilize the contract*

The engine and the conformance suite are shipped. This quarter hardens them and builds the on-ramp.

| Status | Item | Notes |
| --- | --- | --- |
| ✅ | `querypipe` core engine | Field DSL, immutable builder, parse/stringify/canonicalize/validate/apply |
| ✅ | Conformance suite | 23 language-independent JSON vector files + fast-check invariant laws |
| ✅ | Frozen public API + `.d.ts` contract | CI-typechecked against the export list |
| ✅ | Docs site | ADRs + specs + interactive playground (parse ⇄ spec ⇄ string) |
| ✅ | `v0.1.1` | Boundary hardening; `removeFilter` / `clearFilters` / `clearSorts` ([ADR-0012](adr/0012-boundary-hardening.md)) |
| ⏳ | `v0.1.x` patches | Bug fixes only; **no** wire-format or API-surface changes |
| ⏳ | Bundle shrink toward 6 kB | Opt-out position tracking, build-time message→code stripping (see [ADR-0003 §Consequences](adr/0003-error-model.md)) |

**Exit criteria:** published to npm; docs site live; ≥ 1 real integration (an example app or an early adopter) exercising parse → validate → generate end to end.

---

## Next — v0.2.0 · Q4 2026 (Oct–Dec) · Theme: *Generate & interop, wave 1*

The headline of v0.2 is that querypipe stops being client-only: a validated `QuerySpec` becomes a real backend query. Adapters ship as **separate scoped packages** so `querypipe` stays zero-dependency and under budget.

| Status | Item | Contract | Package |
| --- | --- | --- | --- |
| 🧊→⏳ | Prisma adapter | [ADR-0004](adr/0004-adapter-interface.md) `QueryAdapter<TOutput>` | `@querypipe/prisma` |
| 🧊→⏳ | SQL adapter (parametrized, injection-safe) | ADR-0004 §3 (params only, `LIKE` escaping) | `@querypipe/sql` |
| 🧊→⏳ | Keyset / cursor pagination | ADR-0004 §2 · `toCursor(lastRow)` / `applyCursor` → `WHERE (a,b,id) < (?,?,?)` | core + adapters |
| 🧊→⏳ | Spec versioning + `migrate(spec, migrations)` | `version` field ([ADR-0001 §6](adr/0001-queryspec-wire-format.md)) | core |

**Non-negotiable adapter obligations** (already contractual in ADR-0004 §3, will be enforced by adapter vectors): tie-breaker injection parity with client `apply` ([ADR-0005](adr/0005-tie-breaker.md)); every value parametrized; `NULLS FIRST/LAST` emitted wherever the target differs from the [ADR-0008](adr/0008-reference-comparator.md) reference model; `Result`-typed totality (no partial queries).

**Exit criteria:** `@querypipe/prisma` and `@querypipe/sql` produce total orders **identical** to client `apply` for the same spec, verified by shared adapter vectors; keyset pagination round-trips a multi-column sort + tie-breaker.

---

## v0.2.x · Q1 2027 (Jan–Mar) · Theme: *Generate & interop, wave 2*

| Status | Item | Contract | Package |
| --- | --- | --- | --- |
| 🧊→⏳ | Two-way TanStack Table adapter | ADR-0004 · `toTanStackState` / `fromTanStackState` | `@querypipe/tanstack` |
| 🧊→⏳ | Mongo adapter | ADR-0004 (`$regex` metachar escaping) | `@querypipe/mongo` |
| 🧊→⏳ | Syntax dialect plugins | [ADR-0010](adr/0010-dialect-plugins.md) `SyntaxDialect` | `@querypipe/dialect-*` |
| 🧊→⏳ | Page-based pagination dialect | ADR-0010 §3 · `page=2&limit=30` → `offset` at the parse boundary | `@querypipe/dialect-page` |

Flagship dialects: `page=` (the one everyone asks for — converts to `offset` at the edge, never a spec field), JSON:API (`sort=-price,name`), OData (`$orderby`), api-query-params style. Dialects are boundary translators: foreign syntax in, canonical `QuerySpec` out; guards apply to the resulting spec unchanged.

**Exit criteria:** a TanStack Table demo driven entirely through the adapter (no manual wiring, unlike the v0.1 example); the `page=` dialect passes semantic round-trip vectors; migrating from api-query-params keeps existing URLs working server-side.

---

## v0.3.0 · Q2 2027 (Apr–Jun) · Theme: *OR groups & richer schemas*

| Status | Item | Contract |
| --- | --- | --- |
| 🧊→⏳ | **OR group builder** — `orGroup(...)` / nested `and`/`or` | `FilterGroup` type & wire format **already ship in v0.1** ([ADR-0001 §3](adr/0001-queryspec-wire-format.md)) — this only relaxes the v0.1 *acceptance* rule and opens the builder API |
| 🧊→⏳ | Context-aware schema — `q.withContext({ role })`, per-field `visibleWhen(ctx)` | reserved in the v0.2 task scope |
| 🧊→⏳ | Computed fields — `{ get: (row) => T, sql?: string }` | client resolver + adapter mapping |
| 🧊→⏳ | Nested paths — `"author.name"` | `.` reserved out of identifiers since v0.1 ([ADR-0007 §3](adr/0007-string-format.md)) |

The OR-group unlock is the proof of the v0.1 design bet: because the discriminated `FilterNode` AST and its `kind` discriminator shipped from day one, adding OR groups changes **zero** wire bytes and re-runs the **same** existing vectors. Older engines already reject group-bearing specs with a structured error rather than misinterpreting them.

**Exit criteria:** `orGroup` builds nested boolean trees that serialize, round-trip and `apply` correctly; the v0.1 conformance vectors still pass byte-for-byte; a spec with groups validates on v0.3 and fails *gracefully* on v0.1.

---

## Cross-language — querypipe-java 0.1 · Q3 2027 (Jul–Sep) · Theme: *Same contract, second language*

| Status | Item | Contract |
| --- | --- | --- |
| 🧊→⏳ | Java port of the engine | [ADR-0011](adr/0011-java-portability.md) — passes the identical `packages/testing/vectors/*.json` |
| 🧊→⏳ | JPA / Criteria + JDBC adapters | ADR-0004 interface shape, per-language impl |
| 🧊→⏳ | Shared vector CI | one fixture set, two implementations, same green |

The Java port starts from the vectors, **not** from reading TypeScript source. The `VectorEngine` seam in `@querypipe/testing` defines exactly the five operations (`parse/stringify/canonicalize/validate/apply`) it must re-implement. `custom` fields and locale collation are excluded from vectors (not JSON-expressible / ICU-dependent) and covered by per-language unit tests.

**Exit criteria:** querypipe-java is green on the same JSON vectors as the TS core; both languages emit byte-identical canonical strings for the vector corpus.

---

## Later / backlog (unscheduled)

- `diff(other)` / `merge(other)` and query history / undo — cheap on the immutable builder ([ADR-0002](adr/0002-immutable-builder.md)); likely bundled with a v0.2.x or v0.3.x point release.
- Async value validation — `parseQueryAsync` (Standard Schema permits `Promise` results; v0.1 is sync-only by design, [ADR-0009 §4](adr/0009-standard-schema.md)).
- Additional operators beyond the MVP set — only if they deserialize cleanly in both languages.
- Framework-specific ergonomic wrappers (React hooks, Vue composables) — as separate packages, never in core.

---

## How to influence this roadmap

Items are pulled from 🧊/⏳ into a release based on demand. If you need one sooner, open an issue describing the use case (which adapter/dialect, what your URLs look like today, what backend). Because the contracts are already fixed in the ADRs, most of these are well-scoped units of work — good candidates for contribution. Anything that would change the wire format gets weighed against portability first.
