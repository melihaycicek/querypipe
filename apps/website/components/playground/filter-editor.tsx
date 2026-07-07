"use client";

import { useState } from "react";
import type { FilterCondition, FilterNode, QuerySpec } from "querypipe";
import { operatorsForKind, type FieldMeta } from "./preset-config";

/**
 * Filter editor. Additions build a candidate spec that the parent validates
 * through `withSpec` — bad values surface as the library's own structured
 * errors (INVALID_VALUE etc.), never as UI-side guesses.
 */
export function FilterEditor({
  spec,
  fields,
  onSpecCandidate,
}: {
  spec: QuerySpec;
  fields: readonly FieldMeta[];
  onSpecCandidate: (candidate: QuerySpec) => void;
}) {
  const filterable = fields.filter((f) => f.filterable);
  const [fieldName, setFieldName] = useState(filterable[0]?.name ?? "");
  const [op, setOp] = useState("eq");
  const [value1, setValue1] = useState("");
  const [value2, setValue2] = useState("");

  const field = filterable.find((f) => f.name === fieldName) ?? filterable[0];
  if (!field) return null;
  const ops = operatorsForKind(field.kind);
  const activeOp = ops.includes(op) ? op : "eq";
  const needsValue = activeOp !== "isNull" && activeOp !== "notNull";
  const isBetween = activeOp === "between";
  const isList = activeOp === "in" || activeOp === "notIn";
  const isFragmentOp = activeOp === "contains" || activeOp === "startsWith" || activeOp === "endsWith";

  const convert = (raw: string): unknown => {
    // Fragment operators take plain string fragments regardless of kind.
    if (isFragmentOp) return raw;
    switch (field.kind) {
      case "number":
        return Number(raw); // NaN flows into withSpec → INVALID_VALUE (honest)
      case "boolean":
        return raw === "true";
      default:
        return raw;
    }
  };

  const add = () => {
    const condition: FilterCondition = {
      kind: "condition",
      field: field.name,
      op: activeOp as FilterCondition["op"],
      ...(needsValue
        ? {
            value: isBetween
              ? [convert(value1), convert(value2)]
              : isList
                ? value1.split(",").map((part) => convert(part.trim()))
                : convert(value1),
          }
        : {}),
    };
    onSpecCandidate({ ...spec, filters: [...spec.filters, condition] });
  };

  const remove = (index: number) => {
    const filters = spec.filters.filter((_, i) => i !== index);
    onSpecCandidate({ ...spec, filters });
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5" aria-label="Active filters">
        {spec.filters.length === 0 ? (
          <li className="text-xs text-ink-muted">No filters — all rows pass.</li>
        ) : (
          spec.filters.map((node, i) => (
            <li key={i} className="flex items-center gap-2 font-mono text-xs">
              <ConditionLabel node={node} />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove filter"
                className="ml-auto rounded border border-line px-1.5 py-0.5 text-ink-muted transition-colors hover:text-tok-err"
              >
                ×
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2 font-mono text-xs">
        <label className="sr-only" htmlFor="filter-field">Filter field</label>
        <select
          id="filter-field"
          value={field.name}
          onChange={(e) => setFieldName(e.target.value)}
          className="rounded border border-line bg-panel px-1.5 py-1"
        >
          {filterable.map((f) => (
            <option key={f.name} value={f.name}>{f.name}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="filter-op">Operator</label>
        <select
          id="filter-op"
          value={activeOp}
          onChange={(e) => setOp(e.target.value)}
          className="rounded border border-line bg-panel px-1.5 py-1"
        >
          {ops.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        {needsValue ? (
          field.kind === "enum" && !isList && !isBetween && !isFragmentOp ? (
            <select
              aria-label="Value"
              value={value1}
              onChange={(e) => setValue1(e.target.value)}
              className="rounded border border-line bg-panel px-1.5 py-1"
            >
              <option value="">choose…</option>
              {field.enumValues?.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          ) : field.kind === "boolean" && !isList && !isBetween ? (
            <select
              aria-label="Value"
              value={value1}
              onChange={(e) => setValue1(e.target.value)}
              className="rounded border border-line bg-panel px-1.5 py-1"
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              aria-label={isList ? "Values (comma-separated)" : "Value"}
              value={value1}
              onChange={(e) => setValue1(e.target.value)}
              placeholder={isList ? "a, b, c" : field.kind === "date" ? "2026-07-01" : "value"}
              className="w-32 rounded border border-line bg-panel px-1.5 py-1"
            />
          )
        ) : null}
        {isBetween ? (
          <>
            <span className="text-ink-muted">and</span>
            <input
              aria-label="Upper bound"
              value={value2}
              onChange={(e) => setValue2(e.target.value)}
              className="w-24 rounded border border-line bg-panel px-1.5 py-1"
            />
          </>
        ) : null}
        <button
          type="button"
          onClick={add}
          className="rounded border border-tok-key/50 bg-tok-key/10 px-2 py-1 text-tok-key transition-colors hover:bg-tok-key/20"
        >
          Add filter
        </button>
      </div>
    </div>
  );
}

function ConditionLabel({ node }: { node: FilterNode }) {
  if (node.kind !== "condition") {
    return <span className="tok-err">group (v0.3)</span>;
  }
  return (
    <span className="min-w-0 truncate">
      <span className="tok-field">{node.field}</span>
      <span className="tok-sep">:</span>
      <span className="tok-op">{node.op}</span>
      {"value" in node && node.value !== undefined ? (
        <>
          <span className="tok-sep">:</span>
          <span className="tok-value">{JSON.stringify(node.value)}</span>
        </>
      ) : null}
    </span>
  );
}
