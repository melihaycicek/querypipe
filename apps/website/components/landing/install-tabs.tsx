"use client";

import { useState } from "react";
import { INSTALL_COMMANDS } from "@/lib/site";
import { CopyButton } from "@/components/copy-button";

const MANAGERS = Object.keys(INSTALL_COMMANDS) as Array<keyof typeof INSTALL_COMMANDS>;

export function InstallTabs() {
  const [manager, setManager] = useState<keyof typeof INSTALL_COMMANDS>("npm");
  const command = INSTALL_COMMANDS[manager];

  return (
    <div className="panel inline-flex w-full max-w-md flex-col overflow-hidden">
      <div role="tablist" aria-label="Package manager" className="flex border-b border-line">
        {MANAGERS.map((pm) => (
          <button
            key={pm}
            role="tab"
            aria-selected={pm === manager}
            onClick={() => setManager(pm)}
            className={`px-3 py-1.5 font-mono text-xs transition-colors ${
              pm === manager ? "bg-canvas/60 text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {pm}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <code className="font-mono text-[13px]">
          <span className="tok-sep">$ </span>
          <span className="text-ink">{command}</span>
        </code>
        <CopyButton text={command} label="Copy install command" />
      </div>
    </div>
  );
}
