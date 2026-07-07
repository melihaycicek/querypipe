"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isErr, isOk, type FilterCondition, type QuerySpec } from "querypipe";
import {
  HERO_DEFAULT_INPUT,
  PRODUCT_COLUMNS,
  PRODUCTS,
  products,
  type Product,
  type ProductSortField,
} from "@/lib/demo-schema";
import { runDevAssertions } from "@/lib/dev-assert";
import { useDebounced } from "@/lib/use-debounced";
import { DemoTable } from "@/components/demo-table";
import { ErrorList } from "@/components/error-list";
import { SpecJson } from "@/components/spec-json";
import { TokenizedInput } from "@/components/tokenized-input";
import { Wire } from "./wire";

type ProductQuery = typeof products;

const CHIPS: Array<{
  label: string;
  matches: (c: FilterCondition) => boolean;
  add: (q: ProductQuery) => ProductQuery;
}> = [
  {
    label: "price 1000–5000",
    matches: (c) => c.field === "price" && c.op === "between",
    add: (q) => q.filter("price", "between", [1000, 5000]),
  },
  {
    label: "not deleted",
    matches: (c) => c.field === "deletedAt" && c.op === "isNull",
    add: (q) => q.filter("deletedAt", "isNull"),
  },
  {
    label: "in stock",
    matches: (c) => c.field === "stock" && c.op === "gt",
    add: (q) => q.filter("stock", "gt", 0),
  },
];

export function HeroDemo() {
  const [input, setInput] = useState(HERO_DEFAULT_INPUT);
  const [spec, setSpec] = useState<QuerySpec>(() => {
    const parsed = products.parse(HERO_DEFAULT_INPUT);
    return isOk(parsed) ? parsed.value : products.toSpec();
  });
  const [pulse, setPulse] = useState(0);
  const lastCanonical = useRef<string | null>(null);

  useEffect(runDevAssertions, []);

  const builder = useMemo(() => {
    const result = products.withSpec(spec);
    return isOk(result) ? result.value : products;
  }, [spec]);

  // Debounced live parse of whatever is typed (150 ms; parse never throws).
  const debouncedInput = useDebounced(input, 150);
  const parsed = useMemo(() => products.parse(debouncedInput), [debouncedInput]);

  useEffect(() => {
    if (!isOk(parsed)) return;
    const next = products.withSpec(parsed.value);
    if (!isOk(next)) return;
    const canonical = next.value.stringify();
    if (canonical === lastCanonical.current) return;
    lastCanonical.current = canonical;
    setSpec(parsed.value);
    setPulse((n) => n + 1);
  }, [parsed]);

  const errors = isErr(parsed) ? parsed.errors : undefined;
  // Underlines only when the parse result belongs to the visible text.
  const underlineErrors = debouncedInput === input ? errors : undefined;

  const rows = useMemo(
    () => (spec.cursor === undefined ? builder.apply(PRODUCTS as readonly Product[]) : null),
    [builder, spec.cursor],
  );

  /** Header clicks and chips write back into the URL via stringify(). */
  const commit = (next: ProductQuery) => {
    const canonical = next.stringify();
    lastCanonical.current = canonical;
    setSpec(next.toSpec());
    setInput(canonical);
    setPulse((n) => n + 1);
  };

  const onSort = (field: string, additive: boolean) => {
    const sortField = field as ProductSortField;
    const existing = spec.sorts.some((s) => s.field === sortField);
    commit(
      existing
        ? builder.toggleSortDirection(sortField)
        : additive
          ? builder.thenSort(sortField)
          : builder.sort(sortField),
    );
  };

  const toggleChip = (chip: (typeof CHIPS)[number], active: boolean) => {
    if (active) {
      const filters = spec.filters.filter(
        (node) => !(node.kind === "condition" && chip.matches(node)),
      );
      const result = products.withSpec({ ...spec, filters });
      if (isOk(result)) commit(result.value);
    } else {
      commit(chip.add(builder));
    }
  };

  return (
    <div className="panel p-3 sm:p-4">
      <TokenizedInput
        value={input}
        onChange={setInput}
        errors={underlineErrors}
        ariaLabel="Canonical query string — edit to re-parse live"
        placeholder="sort=price:desc&filter=deletedAt:isNull"
      />
      <Wire pulse={pulse} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="panel min-w-0 !bg-canvas/50" aria-label="Parsed QuerySpec">
          <header className="flex items-center justify-between border-b border-line px-3 py-1.5">
            <span className="eyebrow">{errors ? "parse → Result (errors)" : "parse → QuerySpec"}</span>
            {errors ? (
              <span className="font-mono text-[11px] text-tok-err">
                {errors.length} error{errors.length === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="font-mono text-[11px] text-tok-value">ok</span>
            )}
          </header>
          <div className="h-72 overflow-auto p-3">
            {errors ? <ErrorList errors={errors} /> : <SpecJson value={spec} />}
          </div>
        </section>

        <section className="panel min-w-0 !bg-canvas/50" aria-label="Live result rows">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5">
            <span className="eyebrow">apply(rows) — {rows === null ? "—" : rows.length} of {PRODUCTS.length}</span>
            <div className="flex flex-wrap gap-1.5">
              {CHIPS.map((chip) => {
                const active = spec.filters.some(
                  (node) => node.kind === "condition" && chip.matches(node),
                );
                return (
                  <button
                    key={chip.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleChip(chip, active)}
                    className={`rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                      active
                        ? "border-tok-key/60 bg-tok-key/10 text-tok-key"
                        : "border-line text-ink-muted hover:text-ink"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </header>
          <div className="h-72 overflow-auto">
            {rows === null ? (
              <p className="px-3 py-6 text-xs text-ink-muted">
                Specs carrying <code className="font-mono">cursor</code> are not executable
                client-side in v0.1 — keyset execution ships with the v0.2 adapters.
              </p>
            ) : (
              <DemoTable
                rows={rows}
                columns={PRODUCT_COLUMNS}
                sorts={spec.sorts}
                onSort={onSort}
                dimmed={errors !== undefined}
                renderCell={renderProductCell}
              />
            )}
          </div>
          <p className="border-t border-line px-3 py-1.5 text-[11px] text-ink-muted">
            Click a header to <code className="font-mono">sort</code> · shift+click to{" "}
            <code className="font-mono">thenSort</code> · click again to toggle direction. Every
            result on this page comes from the real package at runtime.
          </p>
        </section>
      </div>
    </div>
  );
}

function renderProductCell(row: Product, field: string) {
  if (field === "price") return row.price.toLocaleString("en-US");
  if (field === "reviewCount") return row.reviewCount.toLocaleString("en-US");
  return String(row[field as keyof Product] ?? "—");
}
