import type { ReactNode } from "react";

/**
 * Pretty-prints a QuerySpec (or any JSON value) with the grammar hues:
 * keys → key cyan, strings → value green, numbers/booleans → op amber,
 * punctuation → separator gray. Purely presentational.
 */
export function SpecJson({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre className={`overflow-x-auto whitespace-pre font-mono text-xs leading-6 ${className ?? ""}`}>
      {renderValue(value, 0)}
    </pre>
  );
}

function renderValue(value: unknown, indent: number): ReactNode {
  if (value === null) return <span className="tok-op">null</span>;
  if (typeof value === "string") return <span className="tok-value">{JSON.stringify(value)}</span>;
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="tok-op">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="tok-sep">[]</span>;
    return (
      <>
        <span className="tok-sep">[</span>
        {value.map((item, i) => (
          <span key={i}>
            {"\n" + pad(indent + 1)}
            {renderValue(item, indent + 1)}
            {i < value.length - 1 ? <span className="tok-sep">,</span> : null}
          </span>
        ))}
        {"\n" + pad(indent)}
        <span className="tok-sep">]</span>
      </>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return <span className="tok-sep">{"{}"}</span>;
    return (
      <>
        <span className="tok-sep">{"{"}</span>
        {entries.map(([key, v], i) => (
          <span key={key}>
            {"\n" + pad(indent + 1)}
            <span className="tok-key">&quot;{key}&quot;</span>
            <span className="tok-sep">: </span>
            {renderValue(v, indent + 1)}
            {i < entries.length - 1 ? <span className="tok-sep">,</span> : null}
          </span>
        ))}
        {"\n" + pad(indent)}
        <span className="tok-sep">{"}"}</span>
      </>
    );
  }
  return <span className="tok-err">{String(value)}</span>;
}

function pad(indent: number): string {
  return "  ".repeat(indent);
}
