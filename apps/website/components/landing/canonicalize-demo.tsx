"use client";

import { useMemo, useState } from "react";
import { canonicalize, isOk } from "querypipe";
import { CANONICALIZE_DEMO_INPUT, products } from "@/lib/demo-schema";
import { tokenizeCanonical } from "@/lib/tokenize";
import { ErrorList } from "@/components/error-list";
import { TokenizedInput } from "@/components/tokenized-input";

export function CanonicalizeDemo() {
  const [input, setInput] = useState(CANONICALIZE_DEMO_INPUT);
  const [result, setResult] = useState<ReturnType<typeof canonicalize> | null>(null);

  const run = () => setResult(canonicalize(products, input));

  // Idempotence is verified at runtime, not asserted by copy: we canonicalize
  // the output again and compare byte-for-byte before showing the badge.
  const idempotent = useMemo(() => {
    if (result === null || !isOk(result)) return false;
    const again = canonicalize(products, result.value);
    return isOk(again) && again.value === result.value;
  }, [result]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <TokenizedInput
          value={input}
          onChange={(next) => {
            setInput(next);
            setResult(null);
          }}
          ariaLabel="Query string to canonicalize"
          className="flex-1"
        />
        <button
          type="button"
          onClick={run}
          className="shrink-0 rounded-lg border border-tok-key/50 bg-tok-key/10 px-4 py-2 font-mono text-sm text-tok-key transition-colors hover:bg-tok-key/20"
        >
          Canonicalize
        </button>
      </div>

      <div className="panel min-h-24 p-3">
        {result === null ? (
          <p className="text-xs text-ink-muted">
            Lenient in: segments in any order, direction optional. Press Canonicalize to get the
            byte-stable form.
          </p>
        ) : isOk(result) ? (
          <div className="space-y-2">
            <p className="font-mono text-[13px] leading-6">
              <DiffTokenString from={input} to={result.value} />
            </p>
            {idempotent ? (
              <p className="inline-flex items-center gap-1.5 rounded-full border border-tok-value/50 bg-tok-value/10 px-2.5 py-1 font-mono text-[11px] text-tok-value">
                <svg aria-hidden viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                idempotent — canonicalized twice at runtime, byte-identical
              </p>
            ) : null}
          </div>
        ) : (
          <ErrorList errors={result.errors} />
        )}
      </div>
      <p className="text-sm text-ink-muted">
        Canonical order is fixed — <code className="font-mono text-xs">sort → filter → offset →
        limit → cursor → version</code> — so equal queries are equal strings: perfect cache keys
        and ETags. Highlighted characters were reordered or added.
      </p>
    </div>
  );
}

/**
 * Output string with token colors plus a character-level diff tint: characters
 * that are not part of the longest common subsequence with the input (i.e.
 * moved or inserted) get a background highlight.
 */
function DiffTokenString({ from, to }: { from: string; to: string }) {
  const added = useMemo(() => diffAddedFlags(from, to), [from, to]);
  const tokens = tokenizeCanonical(to);

  // Split tokens further into runs of equal `added` flag.
  const spans: Array<{ text: string; cls: string; added: boolean }> = [];
  for (const token of tokens) {
    let runStart = token.start;
    for (let i = token.start + 1; i <= token.end; i++) {
      if (i === token.end || added[i] !== added[runStart]) {
        spans.push({
          text: to.slice(runStart, i),
          cls: `tok-${token.type}`,
          added: added[runStart] ?? false,
        });
        runStart = i;
      }
    }
  }

  return (
    <span className="font-mono" translate="no">
      <span className="tok-sep">→ </span>
      {spans.map((span, i) => (
        <span key={i} className={`${span.cls} ${span.added ? "rounded-[2px] bg-tok-op/20" : ""}`}>
          {span.text}
        </span>
      ))}
    </span>
  );
}

/** LCS-based per-character "added" flags for `to` relative to `from`. */
function diffAddedFlags(from: string, to: string): boolean[] {
  const n = from.length;
  const m = to.length;
  // Guard: demo strings are short; bail out to "all common" on silly sizes.
  if (n * m > 250_000) return new Array<boolean>(m).fill(false);
  const dp: Uint16Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i]![j] =
        from[i - 1] === to[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  const added = new Array<boolean>(m).fill(true);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (from[i - 1] === to[j - 1]) {
      added[j - 1] = false;
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }
  return added;
}
