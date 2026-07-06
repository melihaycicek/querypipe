# ADR-0005 — Deterministic tie-breaker (`stableBy`) injection

Status: Accepted (v0.1.0)

## Context

A sort over non-unique columns leaves row order partially unspecified. Databases may return ties in any order between calls, which breaks offset/cursor pagination (rows repeat or vanish across pages). The classic fix is a unique final sort column. querypipe makes this a schema-level guarantee instead of a per-call convention.

## Decision

1. The schema may declare `stableBy: "<fieldName>"` — a unique, sortable field (typically the primary key). It is optional but strongly recommended in documentation.

2. **Injection happens at execution time, inside `apply` (and, per ADR-0004, inside every adapter), never inside the spec.** When compiling the comparator:
   - if the sort chain is non-empty and `stableBy` is set and the field is not already in the chain, a final `{ field: stableBy, direction: "asc" }` comparison is appended to the *compiled chain only*;
   - the QuerySpec itself is not modified — parse/stringify round-trips stay byte-identical and the wire never shows the injected column.

3. **Idempotency (conformance property #6).** If the user's chain already contains the `stableBy` field (any position, any direction), nothing is injected. Applying the same spec twice, or applying a spec that spells the tie-breaker out explicitly, yields the same order as the injected form.

4. **Empty sort chain ⇒ no injection.** A filter-only spec preserves input order (client) / native order (backend). Injecting into an empty chain would surprisingly reorder data the user never asked to sort.

5. Injected direction is always `asc`, regardless of the last user sort's direction — one deterministic rule beats a clever one.

6. The injected column does **not** count toward `maxSortColumns` (ADR-0006): guards constrain user input, not engine guarantees.

7. `insertSortAfter`/`thenSort` interplay: because injection is execution-time, a user may still explicitly sort by the `stableBy` field anywhere in the chain; the explicit entry simply wins (rule 3).

## Consequences

- Client `apply` and future SQL/Prisma output produce identical total orders for the same spec — the property-based suite cross-checks `apply` against the reference comparator model with injection enabled.
- Keyset pagination (v0.2) can always rely on a unique column tuple.
- The rule "adapters must inject equivalently" is written into the adapter interface documentation (ADR-0004 §3) — implementing an adapter without it is a conformance failure.
- JS `Array.prototype.sort` stability (guaranteed since ES2019) plus the tie-breaker makes results fully deterministic even for rows missing the `stableBy` value (those fall back to stable input order among themselves).
