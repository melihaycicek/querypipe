import "server-only";
import { createHighlighter, type Highlighter } from "shiki";
import { querypipeShikiThemes } from "./shiki-theme";

/**
 * Server-side Shiki highlighter for landing-page code blocks, using the same
 * palette-derived themes as the docs (`source.config.ts`), so code looks
 * identical everywhere.
 */

let highlighterPromise: Promise<Highlighter> | undefined;

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [querypipeShikiThemes.light as never, querypipeShikiThemes.dark as never],
    langs: ["ts", "tsx", "json", "sh"],
  });
  return highlighterPromise;
}

export type HighlightLang = "ts" | "tsx" | "json" | "sh";

export async function highlight(code: string, lang: HighlightLang): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code.trimEnd(), {
    lang,
    themes: { light: "querypipe-light", dark: "querypipe-dark" },
    defaultColor: false,
  });
}
