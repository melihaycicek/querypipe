# react-table example — querypipe × TanStack Table × nuqs

Manual wiring (no adapter): querypipe owns the query contract, nuqs owns URL state, TanStack Table renders. Demonstrates progressive sorting UX (click = reset chain, shift+click = `thenSort`, same column = toggle) and canonical query strings as shareable URLs.

```sh
pnpm install
pnpm --filter react-table-example dev
```

In v0.2 the manual `spec ↔ table state` seams get replaced by the two-way TanStack adapter (`toTanStackState` / `fromTanStackState`, see ADR-0004).
