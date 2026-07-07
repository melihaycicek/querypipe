import { highlight, type HighlightLang } from "@/lib/highlight";
import { CopyButton } from "./copy-button";

/**
 * Static, server-rendered code block for the landing page. Uses the shared
 * palette-derived Shiki themes; docs code blocks (Fumadocs) use the same ones.
 */
export async function CodeBlock({
  code,
  lang,
  title,
  className,
}: {
  code: string;
  lang: HighlightLang;
  title?: string;
  className?: string;
}) {
  const html = await highlight(code, lang);
  return (
    <figure className={`panel qp-code overflow-hidden ${className ?? ""}`}>
      <figcaption className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <span className="font-mono text-xs text-ink-muted">{title ?? lang}</span>
        <CopyButton text={code.trim()} label={title ? `Copy ${title}` : "Copy code"} />
      </figcaption>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  );
}
