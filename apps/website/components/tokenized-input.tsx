"use client";

import { useEffect, useRef } from "react";
import type { QueryError } from "querypipe";
import { QueryTokenString } from "./query-token-string";

/**
 * Editable canonical-string input with grammar token colors and wavy error
 * underlines. A transparent-text <input> supplies editing, caret and full
 * keyboard behavior; an exactly-aligned <pre> underneath renders the colored
 * tokens. Underlines come from real `QueryError.position` values only.
 */
export function TokenizedInput({
  value,
  onChange,
  errors,
  ariaLabel,
  placeholder,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  errors?: readonly QueryError[];
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const syncScroll = () => {
    if (overlayRef.current && inputRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };

  useEffect(syncScroll, [value]);

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-line bg-panel transition-shadow focus-within:ring-2 focus-within:ring-tok-key/70 ${className ?? ""}`}
    >
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none overflow-x-hidden whitespace-pre px-3 py-2.5 font-mono text-[13px] leading-6 sm:text-sm"
      >
        {value === "" ? (
          <span className="text-ink-muted">{placeholder ?? ""}</span>
        ) : (
          <QueryTokenString value={value} errors={errors} />
        )}
        {/* trailing space keeps the caret column visible at line end */}
        <span> </span>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
        aria-label={ariaLabel}
        aria-invalid={errors !== undefined && errors.length > 0}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        className="absolute inset-0 w-full bg-transparent px-3 py-2.5 font-mono text-[13px] leading-6 text-transparent caret-ink outline-none placeholder:text-transparent focus-visible:outline-none sm:text-sm"
      />
    </div>
  );
}
