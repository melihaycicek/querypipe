"use client";

import { useState } from "react";
import type { SortCondition } from "querypipe";
import type { FieldMeta } from "./preset-config";

/**
 * Sort-chain editor. Every action maps 1:1 to a builder method:
 * add at end → thenSort · add after X → insertSortAfter · flip →
 * toggleSortDirection · remove → removeSort.
 */
export function SortEditor({
  sorts,
  fields,
  onToggle,
  onRemove,
  onAdd,
}: {
  sorts: readonly SortCondition[];
  fields: readonly FieldMeta[];
  onToggle: (field: string) => void;
  onRemove: (field: string) => void;
  onAdd: (field: string, direction: "asc" | "desc", after: string | null) => void;
}) {
  const sortable = fields.filter((f) => f.sortable && !sorts.some((s) => s.field === f.name));
  const [field, setField] = useState("");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [after, setAfter] = useState<string>("end");

  const selectedField = field || sortable[0]?.name || "";

  return (
    <div className="space-y-2">
      <ol className="space-y-1.5" aria-label="Sort chain">
        {sorts.length === 0 ? (
          <li className="text-xs text-ink-muted">No sorts — rows keep input order.</li>
        ) : (
          [...sorts]
            .sort((a, b) => a.priority - b.priority)
            .map((sort) => (
              <li key={sort.field} className="flex items-center gap-2 font-mono text-xs">
                <span className="inline-flex size-5 items-center justify-center rounded border border-line text-[10px] text-ink-muted">
                  {sort.priority}
                </span>
                <span className="tok-field">{sort.field}</span>
                <button
                  type="button"
                  onClick={() => onToggle(sort.field)}
                  aria-label={`Toggle ${sort.field} direction (now ${sort.direction})`}
                  className="tok-op rounded border border-line px-1.5 py-0.5 transition-colors hover:border-ink-muted"
                >
                  {sort.direction}
                  {sort.direction === "asc" ? " ▲" : " ▼"}
                </button>
                {sort.nulls ? <span className="tok-op">nulls {sort.nulls}</span> : null}
                <button
                  type="button"
                  onClick={() => onRemove(sort.field)}
                  aria-label={`Remove ${sort.field} from sort chain`}
                  className="ml-auto rounded border border-line px-1.5 py-0.5 text-ink-muted transition-colors hover:text-tok-err"
                >
                  ×
                </button>
              </li>
            ))
        )}
      </ol>

      {sortable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2 font-mono text-xs">
          <label className="sr-only" htmlFor="sort-add-field">Field to sort by</label>
          <select
            id="sort-add-field"
            value={selectedField}
            onChange={(e) => setField(e.target.value)}
            className="rounded border border-line bg-panel px-1.5 py-1"
          >
            {sortable.map((f) => (
              <option key={f.name} value={f.name}>{f.name}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="sort-add-direction">Direction</label>
          <select
            id="sort-add-direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value as "asc" | "desc")}
            className="rounded border border-line bg-panel px-1.5 py-1"
          >
            <option value="asc">asc</option>
            <option value="desc">desc</option>
          </select>
          <label className="sr-only" htmlFor="sort-add-after">Position</label>
          <select
            id="sort-add-after"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            className="rounded border border-line bg-panel px-1.5 py-1"
          >
            <option value="end">at end (thenSort)</option>
            {sorts.map((s) => (
              <option key={s.field} value={s.field}>after {s.field} (insertSortAfter)</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onAdd(selectedField, direction, after === "end" ? null : after)}
            className="rounded border border-tok-key/50 bg-tok-key/10 px-2 py-1 text-tok-key transition-colors hover:bg-tok-key/20"
          >
            Add sort
          </button>
        </div>
      ) : null}
    </div>
  );
}
