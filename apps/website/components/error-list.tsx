import type { QueryError } from "querypipe";

/**
 * Structured parse errors, exactly as the library returns them: code, field,
 * op, message and 0-based position. Icon + text — never color alone.
 */
export function ErrorList({ errors }: { errors: readonly QueryError[] }) {
  return (
    <ul className="space-y-2" aria-label="Parse errors">
      {errors.map((error, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px] leading-5">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="mt-0.5 size-3.5 shrink-0 text-tok-err"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9" strokeWidth="2" />
            <path d="M12 7.5v5.5m0 3.5v.01" />
          </svg>
          <div className="min-w-0">
            <p className="font-mono text-xs">
              <span className="font-semibold text-tok-err">{error.code}</span>
              {error.field !== undefined ? <span className="tok-field"> {error.field}</span> : null}
              {error.op !== undefined ? <span className="tok-op"> {error.op}</span> : null}
              {error.position !== undefined ? (
                <span className="text-ink-muted"> @ {error.position}</span>
              ) : null}
            </p>
            <p className="text-ink-muted">{error.message}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
