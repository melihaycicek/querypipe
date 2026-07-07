/** The querypipe wordmark — set in the mono, colored by the token system. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-mono font-semibold tracking-tight ${className ?? ""}`} translate="no">
      <span className="text-ink">query</span>
      <span className="text-tok-key">pipe</span>
    </span>
  );
}
