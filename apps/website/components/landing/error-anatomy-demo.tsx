"use client";

import { useMemo, useState } from "react";
import { isErr } from "querypipe";
import { ERROR_DEMO_INPUT, products } from "@/lib/demo-schema";
import { useDebounced } from "@/lib/use-debounced";
import { ErrorList } from "@/components/error-list";
import { TokenizedInput } from "@/components/tokenized-input";

export function ErrorAnatomyDemo() {
  const [input, setInput] = useState(ERROR_DEMO_INPUT);
  const debounced = useDebounced(input, 150);
  const parsed = useMemo(() => products.parse(debounced), [debounced]);
  const errors = isErr(parsed) ? parsed.errors : undefined;

  return (
    <div className="space-y-3">
      <TokenizedInput
        value={input}
        onChange={setInput}
        errors={debounced === input ? errors : undefined}
        ariaLabel="Query string with errors — edit to explore"
      />
      <div className="panel min-h-32 p-3">
        {errors ? (
          <ErrorList errors={errors} />
        ) : (
          <p className="font-mono text-xs text-tok-value">
            ok — this input parses. Break it again to see the error anatomy.
          </p>
        )}
      </div>
      <p className="text-sm text-ink-muted">
        <code className="font-mono text-xs">parse</code> never throws. You get every error, with
        positions, in one pass — the wavy underlines come from each error&rsquo;s{" "}
        <code className="font-mono text-xs">position</code> field.
      </p>
    </div>
  );
}
