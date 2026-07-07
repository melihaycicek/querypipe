"use client";

/**
 * The hero "wire": thin signal paths from the URL input down to the spec and
 * result panes. On each successful parse a token pulse travels the paths
 * (one-shot SMIL, 350 ms). `prefers-reduced-motion` hides the pulses via the
 * `.wire-anim` rule in globals.css.
 */

const LEFT_PATH = "M 50 0 C 50 18, 26 14, 26 34";
const RIGHT_PATH = "M 50 0 C 50 18, 74 14, 74 34";

export function Wire({ pulse }: { pulse: number }) {
  return (
    <div className="relative mx-auto h-9 w-full max-w-lg" aria-hidden>
      <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        <path d={LEFT_PATH} fill="none" stroke="var(--qp-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={RIGHT_PATH} fill="none" stroke="var(--qp-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {pulse > 0 ? (
          <g key={pulse} className="wire-anim">
            <circle r="2.2" fill="var(--tok-key)">
              <animateMotion dur="0.35s" fill="freeze" path={LEFT_PATH} />
            </circle>
            <circle r="2.2" fill="var(--tok-value)">
              <animateMotion dur="0.35s" fill="freeze" path={RIGHT_PATH} />
            </circle>
          </g>
        ) : null}
      </svg>
      <span className="absolute left-[8%] top-1/2 -translate-y-1/2 font-mono text-[10px] text-ink-muted">
        parse ▼
      </span>
      <span className="absolute right-[8%] top-1/2 -translate-y-1/2 font-mono text-[10px] text-ink-muted">
        ▲ stringify
      </span>
    </div>
  );
}
