import Link from "next/link";
import { GITHUB_URL, NPM_URL } from "@/lib/site";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

const NAV = [
  { href: "/docs", label: "Docs" },
  { href: "/playground", label: "Playground" },
  { href: "/roadmap", label: "Roadmap" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-5 px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="querypipe home">
          <Wordmark className="text-[15px]" />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4 text-sm text-ink-muted">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={NPM_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-md border border-line px-2.5 py-1.5 font-mono text-xs text-ink-muted transition-colors hover:text-ink sm:inline-block"
          >
            npm i querypipe
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="querypipe on GitHub"
            className="inline-flex size-8 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:text-ink"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.42c.58.11.79-.25.79-.56v-2.17c-3.2.7-3.88-1.38-3.88-1.38-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.2.68.8.56A11.5 11.5 0 0 0 12 .5Z" />
            </svg>
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
