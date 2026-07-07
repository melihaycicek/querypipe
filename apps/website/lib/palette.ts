/**
 * The grammar-derived token color system — single source of truth.
 *
 * These six hues color the canonical query-string grammar identically
 * everywhere: the hero input, the playground, every Shiki code block and the
 * OG image. CSS custom properties are generated from this file (see
 * `tokenCssVariables`), the Shiki theme imports it (`lib/shiki-theme.ts`) and
 * the OG image route reads the hex values directly — nothing is duplicated
 * by hand.
 *
 * Contrast: every `tok` color and both foregrounds pass WCAG AA (≥ 4.5:1)
 * against `bg` and `bgElev` of their theme — verified by
 * `scripts/contrast-check.mjs`.
 */

export type TokenKind = "key" | "field" | "op" | "value" | "sep" | "err";

export interface ThemePalette {
  /** Page background. */
  bg: string;
  /** Elevated surfaces: panes, code blocks, inputs. */
  bgElev: string;
  border: string;
  fg: string;
  fgMuted: string;
  /** The five grammar hues + error. */
  tok: Record<TokenKind, string>;
}

export const dark: ThemePalette = {
  bg: "#0F141B",
  bgElev: "#151B24",
  border: "#26303F",
  fg: "#E9EDF3",
  fgMuted: "#9AA5B6",
  tok: {
    key: "#5FC6E8", // segment keys: sort= filter= offset= limit= cursor= version=
    field: "#B4A8F5", // field names / aliases
    op: "#E0B65C", // operators, directions, nulls tokens
    value: "#8FCB7F", // values
    sep: "#8593A6", // structural separators : , ; & =
    err: "#F2909C", // unknown / error tokens
  },
};

export const light: ThemePalette = {
  bg: "#F7F8FA",
  bgElev: "#FFFFFF",
  border: "#DCE2EB",
  fg: "#161C26",
  fgMuted: "#525E72",
  tok: {
    key: "#086F8E",
    field: "#5D4FC0",
    op: "#7A5800",
    value: "#2E7030",
    sep: "#5A6680",
    err: "#B32E47",
  },
};

/**
 * CSS custom properties for both themes, injected once in the root layout so
 * stylesheets and this module can never drift apart.
 */
export function tokenCssVariables(): string {
  const vars = (p: ThemePalette) =>
    [
      `--qp-bg:${p.bg}`,
      `--qp-bg-elev:${p.bgElev}`,
      `--qp-border:${p.border}`,
      `--qp-fg:${p.fg}`,
      `--qp-fg-muted:${p.fgMuted}`,
      `--tok-key:${p.tok.key}`,
      `--tok-field:${p.tok.field}`,
      `--tok-op:${p.tok.op}`,
      `--tok-value:${p.tok.value}`,
      `--tok-sep:${p.tok.sep}`,
      `--tok-err:${p.tok.err}`,
    ].join(";");
  // `.dark` is the class next-themes toggles; media query covers first paint
  // before hydration when the stored preference is "system".
  return [
    `:root{${vars(light)}}`,
    `.dark{${vars(dark)}}`,
  ].join("\n");
}
