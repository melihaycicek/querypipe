"use client";

import { useId, useRef, useState, type ReactNode } from "react";

export interface TabDef {
  id: string;
  label: ReactNode;
  panel: ReactNode;
}

/**
 * Minimal WAI-ARIA tabs: roving tabindex, arrow-key navigation, Home/End.
 * Panels stay mounted (demos keep their state when switching).
 */
export function SimpleTabs({ tabs, className }: { tabs: TabDef[]; className?: string }) {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = active === last ? 0 : active + 1;
    else if (event.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next !== null) {
      event.preventDefault();
      setActive(next);
      refs.current[next]?.focus();
    }
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Demos"
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-1 border-b border-line"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={i === active}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={`-mb-px rounded-t-md border-b-2 px-3 py-2 font-mono text-xs transition-colors ${
              i === active
                ? "border-tok-key text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={i !== active}
          tabIndex={0}
          className="pt-4 focus-visible:outline-none"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
