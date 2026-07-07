"use client";

import type { ReactNode } from "react";
import type { SortCondition } from "querypipe";

export interface DemoColumn {
  field: string;
  label: string;
}

/**
 * The demo result table. Sorting is entirely owned by querypipe — this
 * component only renders rows it was given and reports header activations.
 * Click / Enter = plain activation; Shift+Click / Shift+Enter = additive.
 */
export function DemoTable<Row extends { id: number }>({
  rows,
  columns,
  sorts,
  onSort,
  renderCell,
  emptyMessage,
  dimmed,
}: {
  rows: readonly Row[];
  columns: readonly DemoColumn[];
  sorts: readonly SortCondition[];
  onSort?: (field: string, additive: boolean) => void;
  renderCell?: (row: Row, field: string) => ReactNode;
  emptyMessage?: string;
  /** True while the current input has parse errors — table shows last good result. */
  dimmed?: boolean;
}) {
  const sortByField = new Map(sorts.map((s) => [s.field, s]));

  return (
    <div
      className={`overflow-x-auto transition-opacity ${dimmed ? "opacity-45" : ""}`}
      role="group"
      aria-label="Query result"
    >
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line">
            {columns.map((col) => {
              const sort = sortByField.get(col.field);
              const ariaSort =
                sort === undefined ? undefined : sort.direction === "asc" ? "ascending" : "descending";
              return (
                <th key={col.field} scope="col" aria-sort={ariaSort} className="p-0 font-medium">
                  {onSort ? (
                    <button
                      type="button"
                      onClick={(event) => onSort(col.field, event.shiftKey)}
                      className="flex w-full items-center gap-1 px-2.5 py-2 text-left text-ink-muted transition-colors hover:text-ink"
                    >
                      <span>{col.label}</span>
                      {sort ? (
                        <span className="font-mono text-[11px] text-tok-op" aria-hidden>
                          {sort.direction === "asc" ? "▲" : "▼"}
                          {sort.priority}
                        </span>
                      ) : null}
                      {sort ? (
                        <span className="sr-only">
                          sorted {sort.direction === "asc" ? "ascending" : "descending"}, priority{" "}
                          {sort.priority}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    <span className="block px-2.5 py-2 text-ink-muted">{col.label}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-2.5 py-6 text-center text-xs text-ink-muted">
                {emptyMessage ?? "No rows match this query."}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-line/60 last:border-b-0">
                {columns.map((col) => (
                  <td key={col.field} className="px-2.5 py-1.5 tabular-nums">
                    {renderCell
                      ? renderCell(row, col.field)
                      : String((row as Record<string, unknown>)[col.field] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
