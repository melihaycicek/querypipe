/**
 * querypipe × TanStack Table × nuqs — manual wiring (no adapter).
 *
 * querypipe owns the query *contract*: the URL holds a canonical query string,
 * nuqs holds URL state, TanStack renders. There is deliberately no
 * toTanStackState adapter here (that ships in v0.2) — this example shows the
 * seams the adapter will replace.
 *
 * Progressive sorting UX: click = sort (reset chain), shift+click = thenSort
 * (append/refine), same column click = toggle direction.
 */
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { applyQuery, createQuery, isOk, numberField, stringField, enumField } from "querypipe";
import { NuqsAdapter } from "nuqs/adapters/react";
import { createParser, useQueryState } from "nuqs";
import * as React from "react";
import { createRoot } from "react-dom/client";

/* ---------------------------------------------------------------- *
 * 1. The contract: one schema shared (conceptually) with the backend
 * ---------------------------------------------------------------- */

const products = createQuery({
  fields: {
    id: numberField(),
    name: stringField(),
    price: numberField(),
    stock: numberField(),
    category: enumField(["phone", "laptop", "tablet"]),
  },
  stableBy: "id",
  guards: { maxSortColumns: 3 },
});

type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: "phone" | "laptop" | "tablet";
};

const DATA: Product[] = [
  { id: 1, name: "Aria 12", price: 999, stock: 12, category: "phone" },
  { id: 2, name: "Blade 14", price: 1899, stock: 3, category: "laptop" },
  { id: 3, name: "Aria 12 Pro", price: 1299, stock: 12, category: "phone" },
  { id: 4, name: "Slate 11", price: 749, stock: 0, category: "tablet" },
  { id: 5, name: "Blade 16", price: 2399, stock: 5, category: "laptop" },
];

/* ---------------------------------------------------------------- *
 * 2. URL state via nuqs: the URL stores the *canonical* string.
 *    parse → spec; serialize → canonical string (deterministic URLs).
 * ---------------------------------------------------------------- */

const querySpecParser = createParser({
  parse(value: string) {
    const result = products.parse(value);
    return isOk(result) ? result.value : null; // invalid URLs fall back to default
  },
  serialize(spec) {
    const result = products.withSpec(spec);
    return isOk(result) ? result.value.stringify() : "";
  },
});

const DEFAULT_SPEC = products.sort("price", "desc").toSpec();

function ProductTable() {
  const [spec, setSpec] = useQueryState("q", querySpecParser.withDefault(DEFAULT_SPEC));

  // Rebuild an immutable builder from the URL spec each render (cheap: specs are tiny).
  const queryResult = products.withSpec(spec);
  const query = isOk(queryResult) ? queryResult.value : products;

  // Client-side execution: non-mutating, stable, tie-broken by `id`.
  const rows = React.useMemo(() => query.apply(DATA), [query]);

  const sortState = new Map(spec.sorts.map((s) => [s.field, s]));
  const inStockOnly = spec.filters.some(
    (f) => f.kind === "condition" && f.field === "stock" && f.op === "gt",
  );

  const onHeaderClick = (field: "id" | "name" | "price" | "stock" | "category", event: React.MouseEvent) => {
    const existing = sortState.get(field);
    const next = existing
      ? query.toggleSortDirection(field) // same column: flip direction, keep chain position
      : event.shiftKey
        ? query.thenSort(field) // refine: append with next priority
        : query.sort(field); // reset chain: this column becomes priority 1
    void setSpec(next.toSpec());
  };

  const columnHelper = createColumnHelper<Product>();
  const columns = [
    columnHelper.accessor("name", { header: "Name" }),
    columnHelper.accessor("category", { header: "Category" }),
    columnHelper.accessor("price", { header: "Price" }),
    columnHelper.accessor("stock", { header: "Stock" }),
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Sorting/filtering are fully owned by querypipe — TanStack only renders.
    manualSorting: true,
    manualFiltering: true,
  });

  return (
    <div>
      <p>
        Click a header to sort, <kbd>shift</kbd>+click to add it to the sort chain (progressive
        sorting). The URL query param <code>q</code> always holds the canonical querypipe string.
      </p>
      {/* filter() always appends, so a toggle removes first — otherwise every click stacks a duplicate. */}
      <label>
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={() =>
            void setSpec(
              (inStockOnly
                ? query.removeFilter("stock", "gt")
                : query.filter("stock", "gt", 0)
              ).toSpec(),
            )
          }
        />{" "}
        In stock only
      </label>
      <table>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const field = header.column.id as "name" | "price" | "stock" | "category";
                const sort = sortState.get(field);
                return (
                  <th key={header.id} onClick={(e) => onHeaderClick(field, e)}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {sort ? ` ${sort.direction === "asc" ? "▲" : "▼"}${sort.priority}` : ""}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <NuqsAdapter>
    <ProductTable />
  </NuqsAdapter>,
);
