const FEATURES = [
  {
    eyebrow: "SortableField<F>",
    title: "Type-safe end to end",
    body: "Field names are literal types inferred from the schema; operator/value pairs are checked at compile time — between wants [T, T], isNull accepts no value, enumField narrows to a union.",
    typeError: true,
  },
  {
    eyebrow: "thenSort",
    title: "Progressive multi-sort, first-class",
    body: "sort resets, thenSort appends without disturbing prior priorities, insertSortAfter / removeSort / toggleSortDirection edit the chain in place. Priorities renormalize to 1..n on every step.",
  },
  {
    eyebrow: "guards",
    title: "Backend-safe by default",
    body: "A mandatory field whitelist (there is no schema-less parse), guard limits on sort columns, filter count, value length and in-list size — and no user input ever becomes a RegExp.",
  },
  {
    eyebrow: "stableBy",
    title: "Deterministic",
    body: "Byte-stable canonical stringify, stable sort with an auto-injected unique tie-breaker, and one fixed SQL ORDER BY reference model (PostgreSQL NULL semantics) for client apply and future adapters.",
  },
  {
    eyebrow: "0 deps",
    title: "Tiny & dependency-free",
    body: "Zero runtime dependencies, ESM + CJS with correct types for both, fully tree-shakable, ≈7.4 kB min+gzip. Runs on Node ≥ 18.17 and any modern browser.",
  },
  {
    eyebrow: "QueryResult<T>",
    title: "Structured errors, never thrown",
    body: "parse and validate return a multi-error Result — every problem, with codes and positions, in one pass. Only schema/builder misuse throws TypeError; the data path never does.",
  },
] as const;

export function FeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((feature) => (
        <article key={feature.title} className="panel flex flex-col gap-2 p-4">
          <p className="eyebrow">{feature.eyebrow}</p>
          <h3 className="text-[15px] font-semibold">{feature.title}</h3>
          <p className="text-sm leading-relaxed text-ink-muted">{feature.body}</p>
          {"typeError" in feature && feature.typeError ? <TypeErrorFigure /> : null}
        </article>
      ))}
    </div>
  );
}

/**
 * The compile-error moment, drawn as an editor excerpt. The message is the
 * real diagnostic captured from `tsc --noEmit` against this schema
 * (TS2345; long inferred type elided with … for width).
 */
function TypeErrorFigure() {
  return (
    <figure className="mt-1 rounded-lg border border-line bg-canvas/60 p-3 font-mono text-xs leading-6">
      <code>
        <span className="text-ink">products</span>
        <span className="tok-sep">.</span>
        <span className="tok-key">sort</span>
        <span className="tok-sep">(</span>
        <span className="tok-value underline decoration-wavy decoration-1 [text-decoration-color:var(--tok-err)] underline-offset-4">
          &quot;pricee&quot;
        </span>
        <span className="tok-sep">)</span>
      </code>
      <figcaption className="mt-2 border-l-2 border-tok-err/60 pl-2 text-[11px] leading-5 text-ink-muted">
        <span className="text-tok-err">TS2345</span>: Argument of type{" "}
        <span className="tok-value">&apos;&quot;pricee&quot;&apos;</span> is not assignable to
        parameter of type <span className="tok-field">&apos;SortableField&lt;…&gt;&apos;</span>.
      </figcaption>
    </figure>
  );
}
