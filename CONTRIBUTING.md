# Contributing to querypipe

Thanks for your interest. querypipe is a **contract-first** library: the conformance vectors and the ADRs are the source of truth, and the implementation serves them — not the other way around. That shapes how contributions work.

## Ground rules

1. **The wire format is frozen.** The `QuerySpec` shape, the JSON wire format and the canonical string grammar don't change outside a major version. New capabilities unlock *behavior*, not *shape* (see the [roadmap](docs/ROADMAP.md)). If your idea needs a new wire field or operator, open an issue first and expect it to be weighed against **Java portability** — the top priority.
2. **Vectors before implementation.** A behavior change lands as a failing JSON vector in [`packages/testing/vectors/`](packages/testing/vectors) *first*, then the code that makes it pass. The same files are the acceptance suite for the future `querypipe-java` port, so they must stay language-independent (no `custom` comparators, no locale collation).
3. **Decisions get an ADR.** Anything architectural is recorded in [`docs/adr/`](docs/adr). Read the existing 12 before proposing a change; reference the ADR your PR touches.
4. **No new runtime dependencies in `querypipe`.** Zero-dependency is a hard constraint. Adapters and dialects live in their own scoped packages.

## Priority order for any trade-off

**(1) Java portability → (2) type safety → (3) bundle size → (4) API ergonomics.** State which applies when a design choice is non-obvious.

## Dev setup

```sh
pnpm install
pnpm build        # tsup → ESM + CJS + .d.ts
pnpm test         # vitest: unit + conformance vectors + fast-check invariants
pnpm typecheck
pnpm check        # everything CI runs (build, typecheck, tests, publint, attw, size gate)
```

Node ≥ 18.17, pnpm (version pinned via `packageManager`).

## Making a change

1. Branch from `main`.
2. If behavior changes: add/adjust a vector, watch it fail, then implement.
3. Keep `pnpm check` green — including the frozen public-API typecheck (`pnpm check:contract`) and the bundle-size gate.
4. Add a changeset: `pnpm changeset` (describes the release note and semver bump).
5. Open a PR referencing the relevant ADR / vector / roadmap item.

## Reporting bugs

Include the schema, the input (string or spec), what you got, and what you expected — ideally as a minimal vector case. Parse/validate never throw, so a bug report is usually "wrong `code`/`field`/`position`" or "wrong `apply` order", which maps directly to a vector.

## License

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
