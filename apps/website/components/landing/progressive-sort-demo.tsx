"use client";

import { useMemo, useState } from "react";
import { isOk, type QuerySpec } from "querypipe";
import { PRODUCT_COLUMNS, PRODUCTS, products, type ProductSortField } from "@/lib/demo-schema";
import { DemoTable } from "@/components/demo-table";
import { QueryTokenString } from "@/components/query-token-string";

export function ProgressiveSortDemo() {
  const [spec, setSpec] = useState<QuerySpec>(() => products.sort("category").toSpec());

  const builder = useMemo(() => {
    const result = products.withSpec(spec);
    return isOk(result) ? result.value : products;
  }, [spec]);

  const rows = useMemo(() => builder.apply(PRODUCTS), [builder]);

  const onSort = (field: string, additive: boolean) => {
    const f = field as ProductSortField;
    const existing = spec.sorts.some((s) => s.field === f);
    const next = existing
      ? builder.toggleSortDirection(f)
      : additive
        ? builder.thenSort(f)
        : builder.sort(f);
    setSpec(next.toSpec());
  };

  return (
    <div className="space-y-3">
      <div className="panel max-h-80 overflow-auto">
        <DemoTable rows={rows} columns={PRODUCT_COLUMNS} sorts={spec.sorts} onSort={onSort} />
      </div>
      <p className="font-mono text-xs" aria-live="polite">
        <span className="tok-sep">→ </span>
        <QueryTokenString value={builder.stringify()} />
      </p>
      <p className="text-sm text-ink-muted">
        <code className="font-mono text-xs">sort</code> resets,{" "}
        <code className="font-mono text-xs">thenSort</code> refines — priorities renormalize to
        1..n. Click a header to reset the chain, shift+click to append. The 1899 price tie and the
        4.3-rating/530-review tie make the refinement visible.
      </p>
    </div>
  );
}
