# ADR-0002 — Immutable builder & progressive sort semantics

Status: Accepted (v0.1.0)

## Context

Progressive (additive) sorting is the core UX behavior: clicking a column header must refine, not destroy, the existing order. Planned v0.2 features (`diff`, `merge`, query history/undo) require cheap structural snapshots. A mutable builder makes both fragile.

## Decision

1. **Every builder method returns a new immutable query instance.** The internal QuerySpec of a builder is deep-frozen (`Object.freeze`); the schema definition is shared structurally between instances. There is no mutating API at all.

2. Progressive sort semantics (all methods renormalize `priority` to a contiguous `1..n` afterwards):

   | Method | Semantics |
   | ------ | --------- |
   | `sort(field, dir?, opts?)` | **Resets** the chain; the field becomes priority 1. |
   | `thenSort(field, dir?, opts?)` | Appends at the end **without touching existing priorities**. If the field is already in the chain, its `direction`/`nulls` are updated **in place** (its priority is kept); a field appears at most once. |
   | `insertSortAfter(after, field, dir?, opts?)` | Removes `field` if present, inserts it right after `after`. If `after` is not in the chain, appends at the end. |
   | `removeSort(field)` | Removes the field, renormalizes. Absent field ⇒ no-op. |
   | `toggleSortDirection(field)` | Flips `asc`/`desc` in place, keeps priority and `nulls`. Absent field ⇒ no-op (UIs decide whether to `thenSort` instead). |

   Invariant (conformance property #4): `thenSort` never changes the `(field, direction, priority)` triple of any pre-existing sort.

3. Default direction is `asc`. `nulls` is optional and absolute (ADR-0008).

4. Pagination on the builder: `limit(n)` / `offset(n)` clamp to non-negative integers; `cursor(c)` sets the cursor. Setting `cursor` clears `offset` and vice versa (last write wins), so a builder can never emit a `CONFLICTING_PAGINATION` spec.

5. **Builders are valid by construction.** Schema-typed methods validate eagerly at runtime too (for plain-JS callers) and misuse throws `TypeError` (ADR-0003 draws this line). Consequently `query.stringify(): string` and `query.apply(rows): Row[]` return plain values — no Result unwrapping on the trusted local path.

6. External specs enter a builder only through `query.withSpec(spec): QueryResult<Query>` — a validation boundary, because the spec may come from a wire. This preserves invariant (5).

7. Guards (ADR-0006) are **not** enforced by builder mutations. Guards protect the inbound boundary (parse/validate); local code may build any spec and check it with `validateQuerySpec` before sending.

## Consequences

- Undo/redo and `diff`/`merge` (v0.2) become snapshot comparisons of frozen specs — no defensive copying.
- Each mutation allocates a small new spec; specs are tiny (bounded by guards), so this is negligible and keeps the < 6 kB gzip budget (no persistent-data-structure library).
- `toSpec()` can safely hand out the internal spec object without cloning (it is frozen).
- Java port: the builder is a class with `final` fields returning new instances; semantics table above is normative for both languages.
