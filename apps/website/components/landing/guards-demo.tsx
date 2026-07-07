"use client";

import { useMemo, useState } from "react";
import { isErr } from "querypipe";
import { GUARD_DEMO_FIELDS, products } from "@/lib/demo-schema";
import { ErrorList } from "@/components/error-list";
import { QueryTokenString } from "@/components/query-token-string";

export function GuardsDemo() {
  const [count, setCount] = useState(2);

  const input = useMemo(
    () =>
      "sort=" +
      GUARD_DEMO_FIELDS.slice(0, count)
        .map((field) => `${field}:asc`)
        .join(","),
    [count],
  );

  // The guard fires inside the real parse — the schema declares maxSortColumns: 3.
  const parsed = useMemo(() => products.parse(input), [input]);
  const errors = isErr(parsed) ? parsed.errors : undefined;

  return (
    <div className="space-y-3">
      <label className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-ink-muted">sort columns</span>
        <input
          type="range"
          min={1}
          max={GUARD_DEMO_FIELDS.length}
          step={1}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          aria-valuetext={`${count} sort columns`}
          className="w-48 accent-(--tok-key)"
        />
        <span className="font-mono text-xs tabular-nums">
          {count} / guard <span className="tok-op">maxSortColumns: 3</span>
        </span>
      </label>

      <p className="font-mono text-[13px] leading-6" aria-live="polite">
        <QueryTokenString value={input} errors={errors} />
      </p>

      <div className="panel min-h-24 p-3">
        {errors ? (
          <ErrorList errors={errors} />
        ) : (
          <p className="font-mono text-xs text-tok-value">
            ok — {count} sort column{count === 1 ? "" : "s"} accepted
          </p>
        )}
      </div>
      <p className="text-sm text-ink-muted">
        Backend-safe by default: whitelist + limits, before your database ever sees the query.
        Guards also cap filters, value length and <code className="font-mono text-xs">in</code>{" "}
        list size.
      </p>
    </div>
  );
}
