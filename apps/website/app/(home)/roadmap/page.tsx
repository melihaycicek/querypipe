import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "The querypipe quarterly plan: v0.1 stabilization, v0.2 adapters and dialects, v0.3 OR groups, and the querypipe-java port.",
};

/**
 * Rendered from the repository's docs/ROADMAP.md content (mirrored, not
 * invented). The full tables with exit criteria live in the docs copy.
 */
export default function RoadmapPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <p className="eyebrow mb-2">🧊 reserved → ⏳ planned → ✅ done</p>
      <h1 className="text-2xl font-semibold tracking-tight">Roadmap & quarterly plan</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
        Each item names the ADR that already fixed its contract, so shipping it is
        implementation, not design. The <code className="font-mono text-xs">QuerySpec</code>{" "}
        shape and JSON wire format are frozen — new capabilities unlock behavior, not shape. On
        any trade-off: Java portability → type safety → bundle size → ergonomics.
      </p>

      <div className="mt-10 space-y-8">
        <Phase
          period="Now — v0.1.x · Q3 2026"
          title="Stabilize the contract"
          items={[
            ["done", "querypipe core engine — field DSL, immutable builder, parse/stringify/canonicalize/validate/apply"],
            ["done", "Conformance suite — 23 language-independent JSON vector files + fast-check invariant laws"],
            ["done", "Frozen public API + .d.ts contract, CI-typechecked against the export list"],
            ["done", "Docs site — ADRs + specs + interactive playground (this site)"],
            ["done", "v0.1.1 — boundary hardening; removeFilter / clearFilters / clearSorts (ADR-0012)"],
            ["planned", "v0.1.x patches — bug fixes only; no wire-format or API-surface changes"],
            ["planned", "Bundle shrink toward 6 kB — opt-out position tracking, message→code stripping"],
          ]}
          exit="Published to npm; docs site live; ≥ 1 real integration exercising parse → validate → generate end to end."
        />

        <Phase
          period="Next — v0.2.0 · Q4 2026"
          title="Generate & interop, wave 1"
          items={[
            ["planned", "@querypipe/prisma — QuerySpec → param-safe findMany args (ADR-0004)"],
            ["planned", "@querypipe/sql — parametrized, injection-safe, LIKE-escaped (ADR-0004 §3)"],
            ["planned", "Keyset / cursor pagination — toCursor(lastRow) / applyCursor (ADR-0004 §2)"],
            ["planned", "Spec versioning + migrate(spec, migrations) (ADR-0001 §6)"],
          ]}
          exit="Adapters produce total orders identical to client apply for the same spec, verified by shared adapter vectors; keyset pagination round-trips a multi-column sort + tie-breaker."
        />

        <Phase
          period="v0.2.x · Q1 2027"
          title="Generate & interop, wave 2"
          items={[
            ["planned", "Two-way TanStack Table adapter — toTanStackState / fromTanStackState"],
            ["planned", "@querypipe/mongo — with $regex metachar escaping by contract"],
            ["planned", "Syntax dialect plugins (ADR-0010): page=, JSON:API, OData, api-query-params style"],
          ]}
          exit="A TanStack demo driven entirely through the adapter; the page= dialect passes semantic round-trip vectors; api-query-params URLs keep working server-side."
        />

        <Phase
          period="v0.3.0 · Q2 2027"
          title="OR groups & richer schemas"
          items={[
            ["planned", "orGroup(...) builder — the FilterGroup type & wire format already ship in v0.1, so this is a pure API unlock; zero wire bytes change"],
            ["planned", "Context-aware schema — withContext({ role }), per-field visibleWhen(ctx)"],
            ["planned", "Computed fields and nested paths (\"author.name\" — the dot is reserved since v0.1)"],
          ]}
          exit="orGroup builds nested boolean trees that serialize, round-trip and apply correctly; the v0.1 vectors still pass byte-for-byte; group specs fail gracefully on v0.1 engines."
        />

        <Phase
          period="querypipe-java 0.1 · Q3 2027"
          title="Same contract, second language"
          items={[
            ["planned", "Java port of the engine — passes the identical JSON conformance vectors"],
            ["planned", "JPA / Criteria + JDBC adapters"],
            ["planned", "Shared vector CI — one fixture set, two implementations, same green"],
          ]}
          exit="querypipe-java is green on the same JSON vectors as the TS core; both languages emit byte-identical canonical strings for the vector corpus."
        />
      </div>

      <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-6 text-sm">
        <Link href="/docs/reference/roadmap" className="text-tok-key underline-offset-4 hover:underline">
          Full tables with ADR references →
        </Link>
        <a
          href="https://github.com/melihaycicek/querypipe/blob/main/docs/ROADMAP.md"
          target="_blank"
          rel="noreferrer"
          className="text-ink-muted underline-offset-4 hover:underline"
        >
          docs/ROADMAP.md on GitHub
        </a>
      </div>
    </div>
  );
}

function Phase({
  period,
  title,
  items,
  exit,
}: {
  period: string;
  title: string;
  items: Array<[status: "done" | "planned", text: string]>;
  exit: ReactNode;
}) {
  return (
    <section className="panel p-5">
      <p className="eyebrow">{period}</p>
      <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed">
        {items.map(([status, text]) => (
          <li key={text} className="flex gap-2.5">
            <span
              className={`mt-0.5 shrink-0 font-mono text-xs ${
                status === "done" ? "text-tok-value" : "text-tok-op"
              }`}
              aria-hidden
            >
              {status === "done" ? "✅" : "⏳"}
            </span>
            <span className="sr-only">{status === "done" ? "Done:" : "Planned:"}</span>
            <span className="text-ink-muted">{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
        <span className="font-mono">exit criteria</span> — {exit}
      </p>
    </section>
  );
}
