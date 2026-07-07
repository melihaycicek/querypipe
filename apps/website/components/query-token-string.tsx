import { tokenizeCanonical, errorRanges, type QueryToken } from "@/lib/tokenize";

/**
 * Renders a canonical query string with the grammar-derived token colors.
 * The same classes (`tok-*`) style the hero input, the playground, docs
 * callouts and (via `lib/palette.ts`) the OG image — one system, everywhere.
 */
export function QueryTokenString({
  value,
  errors,
  className,
}: {
  value: string;
  /** Parse errors whose `position` should be underlined. */
  errors?: readonly { position?: number }[];
  className?: string;
}) {
  if (value === "") {
    return <span className={className ?? ""} />;
  }
  const tokens = tokenizeCanonical(value);
  const ranges = errors ? errorRanges(value, errors, tokens) : [];
  return (
    <span className={`font-mono ${className ?? ""}`} translate="no">
      {tokens.map((token, i) => (
        <span key={i} className={tokenClass(token, ranges)}>
          {token.text}
        </span>
      ))}
    </span>
  );
}

function tokenClass(token: QueryToken, ranges: Array<{ start: number; end: number }>): string {
  const underlined = ranges.some((r) => token.start < r.end && r.start < token.end);
  return `tok-${token.type}${underlined ? " tok-underline-err" : ""}`;
}
