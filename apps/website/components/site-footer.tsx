import Link from "next/link";
import { GITHUB_URL, NPM_URL } from "@/lib/site";
import { QueryTokenString } from "./query-token-string";
import { Wordmark } from "./wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Wordmark className="text-sm" />
            <p className="max-w-xs text-sm text-ink-muted">
              A typed query behavior engine for filtering, progressive multi-sorting, pagination
              and backend-safe query generation.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
            <Link href="/docs" className="text-ink-muted transition-colors hover:text-ink">Docs</Link>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-ink-muted transition-colors hover:text-ink">GitHub</a>
            <Link href="/playground" className="text-ink-muted transition-colors hover:text-ink">Playground</Link>
            <a href={NPM_URL} target="_blank" rel="noreferrer" className="text-ink-muted transition-colors hover:text-ink">npm</a>
            <Link href="/roadmap" className="text-ink-muted transition-colors hover:text-ink">Roadmap</Link>
            <Link href="/privacy" className="text-ink-muted transition-colors hover:text-ink">Privacy</Link>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>MIT license © querypipe contributors</p>
          <p className="flex flex-wrap items-center gap-x-2">
            <span>Built with querypipe managing this page&rsquo;s URL —</span>
            <QueryTokenString value="sort=price:desc&filter=deletedAt:isNull" className="text-[11px]" />
          </p>
        </div>
      </div>
    </footer>
  );
}
