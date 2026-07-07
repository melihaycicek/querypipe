import type { Metadata } from "next";
import { Suspense } from "react";
import { Playground } from "@/components/playground/playground";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Build, parse and apply querypipe queries live. The page URL itself is managed by querypipe — share it to share the query.",
};

export default function PlaygroundPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow mb-2">parse ⇄ stringify ⇄ apply</p>
      <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
      <p className="mb-6 mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
        Everything below runs the real npm package in your browser. Edit the canonical string, the
        sort chain or the filters — each stays in lock-step with the others, and with this
        page&rsquo;s URL.
      </p>
      <Suspense fallback={<PlaygroundSkeleton />}>
        <Playground />
      </Suspense>
    </div>
  );
}

/** Fixed-height placeholder so the static shell paints without layout shift. */
function PlaygroundSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-9 w-64 animate-pulse rounded-lg border border-line bg-panel" />
      <div className="h-11 animate-pulse rounded-lg border border-line bg-panel" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="h-96 animate-pulse rounded-lg border border-line bg-panel" />
        <div className="h-96 animate-pulse rounded-lg border border-line bg-panel" />
      </div>
    </div>
  );
}
