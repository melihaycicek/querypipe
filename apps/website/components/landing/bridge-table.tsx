/** Positioning table — verbatim from the repository README. */
const ROWS = [
  {
    concern: "URL state persistence",
    owner: "nuqs, URLSearchParams",
    role: "Produces/consumes the canonical query string they store",
  },
  {
    concern: "Table UI state",
    owner: "TanStack Table",
    role: "Two-way adapter (v0.2): table state ⇄ the same QuerySpec",
  },
  {
    concern: "Mongo query parsing",
    owner: "api-query-params",
    role: "Compat dialect (v0.2): parse their syntax → canonical spec",
  },
  {
    concern: "ORM execution",
    owner: "Prisma, Drizzle, raw SQL",
    role: "Adapters (v0.2): QuerySpec → param-safe where/orderBy",
  },
] as const;

export function BridgeTable() {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="px-4 py-2.5 font-mono text-xs font-medium text-ink-muted">Concern</th>
            <th scope="col" className="px-4 py-2.5 font-mono text-xs font-medium text-ink-muted">Owned by</th>
            <th scope="col" className="px-4 py-2.5 font-mono text-xs font-medium text-ink-muted">querypipe&rsquo;s role</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.concern} className="border-b border-line/60">
              <td className="px-4 py-2.5">{row.concern}</td>
              <td className="px-4 py-2.5 text-ink-muted">{row.owner}</td>
              <td className="px-4 py-2.5 text-ink-muted">{row.role}</td>
            </tr>
          ))}
          <tr className="bg-tok-key/5">
            <td className="px-4 py-2.5 font-semibold">The query contract</td>
            <td className="px-4 py-2.5 text-ink-muted">—</td>
            <td className="px-4 py-2.5 font-semibold">
              <span className="font-mono">querypipe</span> — one typed spec everyone agrees on
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
