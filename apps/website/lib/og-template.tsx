import type { ReactElement } from "react";
import { dark, type TokenKind } from "./palette";
import { tokenizeCanonical } from "./tokenize";

/**
 * Shared OG-image template (1200×630). Token hues come straight from
 * lib/palette.ts — the same values the site CSS and Shiki themes use — and
 * the string is colored by the same tokenizer as the hero input.
 */

const TOKEN_HEX: Record<TokenKind, string> = dark.tok;

export const OG_SIZE = { width: 1200, height: 630 };

export function OgCard({
  title,
  canonical,
  subtitle,
}: {
  title: string;
  canonical: string;
  subtitle?: string;
}): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: dark.bg,
        padding: 64,
        fontFamily: "IBM Plex Mono",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>
          <span style={{ color: dark.fg }}>query</span>
          <span style={{ color: dark.tok.key }}>pipe</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: dark.fgMuted,
            border: `1px solid ${dark.border}`,
            borderRadius: 999,
            padding: "8px 20px",
          }}
        >
          v0.1 · 0 deps · ≈7.4 kB
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          backgroundColor: dark.bgElev,
          border: `1px solid ${dark.border}`,
          borderRadius: 16,
          padding: "36px 40px",
          fontSize: 30,
          lineHeight: 1.6,
        }}
      >
        {tokenizeCanonical(canonical).map((token, i) => (
          <span key={i} style={{ color: TOKEN_HEX[token.type] }}>
            {token.text}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", fontSize: 34, color: dark.fg, fontWeight: 600 }}>
          {title}
        </div>
        {subtitle ? (
          <div style={{ display: "flex", fontSize: 24, color: dark.fgMuted }}>{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
