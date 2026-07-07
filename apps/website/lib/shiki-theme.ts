/**
 * Shiki themes generated from the grammar token palette (`lib/palette.ts`) so
 * code blocks in docs and on the landing page use exactly the same hues as
 * the canonical-string tokenizer. One family, everywhere:
 *
 *   keywords/storage → field (violet)   strings → value (green)
 *   numbers/booleans → op (amber)       functions/types → key (cyan)
 *   punctuation/operators → sep (gray)  comments → muted italic
 */
import { dark, light, type ThemePalette } from "./palette";

type TokenColorRule = {
  scope: string | string[];
  settings: { foreground?: string; fontStyle?: string };
};

export interface ShikiThemeRegistration {
  name: string;
  type: "light" | "dark";
  colors: Record<string, string>;
  tokenColors: TokenColorRule[];
}

function buildTheme(name: string, type: "light" | "dark", p: ThemePalette): ShikiThemeRegistration {
  return {
    name,
    type,
    colors: {
      "editor.background": p.bgElev,
      "editor.foreground": p.fg,
    },
    tokenColors: [
      { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: p.fgMuted, fontStyle: "italic" } },
      { scope: ["string", "punctuation.definition.string"], settings: { foreground: p.tok.value } },
      { scope: ["constant.numeric", "constant.language", "constant.other"], settings: { foreground: p.tok.op } },
      { scope: ["keyword", "storage.type", "storage.modifier", "keyword.control"], settings: { foreground: p.tok.field } },
      { scope: ["keyword.operator", "punctuation", "meta.brace"], settings: { foreground: p.tok.sep } },
      {
        scope: ["entity.name.function", "support.function", "meta.function-call.generic"],
        settings: { foreground: p.tok.key },
      },
      {
        scope: [
          "entity.name.type",
          "entity.name.class",
          "entity.other.inherited-class",
          "support.type",
          "support.class",
        ],
        settings: { foreground: p.tok.key },
      },
      // JSON object keys read as structural — key hue, values stay green/amber.
      { scope: ["support.type.property-name.json"], settings: { foreground: p.tok.key } },
      { scope: ["variable", "variable.other", "meta.object-literal.key"], settings: { foreground: p.fg } },
      { scope: ["entity.name.tag"], settings: { foreground: p.tok.field } },
      { scope: ["entity.other.attribute-name"], settings: { foreground: p.tok.op } },
      { scope: ["markup.underline.link", "string.other.link"], settings: { foreground: p.tok.key } },
    ],
  };
}

export const querypipeShikiThemes = {
  dark: buildTheme("querypipe-dark", "dark", dark),
  light: buildTheme("querypipe-light", "light", light),
};
