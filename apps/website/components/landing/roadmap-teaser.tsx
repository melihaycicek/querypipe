import Link from "next/link";

const PHASES = [
  {
    version: "v0.2",
    title: "Generate & interop",
    items: [
      "@querypipe/prisma and @querypipe/sql adapters — QuerySpec → param-safe where/orderBy",
      "Two-way TanStack Table adapter",
      "Syntax dialects: page=, JSON:API, OData",
      "Keyset / cursor pagination",
    ],
  },
  {
    version: "v0.3",
    title: "OR groups",
    items: [
      "orGroup(...) builder for nested and/or trees",
      "The FilterGroup type and wire format already ship in v0.1 — this is a pure API unlock, zero wire bytes change",
    ],
  },
  {
    version: "querypipe-java",
    title: "Same contract, second language",
    items: [
      "Java port validated against the identical JSON conformance vectors",
      "JPA/Criteria + JDBC adapters",
      "Byte-identical canonical strings across both languages",
    ],
  },
] as const;

export function RoadmapTeaser() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PHASES.map((phase) => (
        <article key={phase.version} className="panel flex flex-col gap-2 p-4">
          <p className="eyebrow">
            <span className="text-tok-op">{phase.version}</span> · roadmap
          </p>
          <h3 className="text-[15px] font-semibold">{phase.title}</h3>
          <ul className="space-y-1.5 text-sm leading-relaxed text-ink-muted">
            {phase.items.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-tok-sep" />
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/roadmap"
            className="mt-auto pt-1 text-sm text-tok-key underline-offset-4 hover:underline"
          >
            Full quarterly plan →
          </Link>
        </article>
      ))}
    </div>
  );
}
