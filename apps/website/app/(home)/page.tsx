import dynamic from "next/dynamic";
import Link from "next/link";
import type { ReactNode } from "react";
import { HeroDemo } from "@/components/landing/hero-demo";
import { BridgeTable } from "@/components/landing/bridge-table";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { InstallTabs } from "@/components/landing/install-tabs";
import { NewsletterForm } from "@/components/landing/newsletter-form";
import { RoadmapTeaser } from "@/components/landing/roadmap-teaser";
import { ServerStory } from "@/components/landing/server-story";
import {
  GITHUB_URL,
  HEADLINE,
  LATEST_RELEASE,
  SITE_DESCRIPTION,
  SITE_URL,
  STATS,
} from "@/lib/site";

// The try-it strip is interactive-only below the fold — code-split so the
// static shell paints first.
const TryStrip = dynamic(() =>
  import("@/components/landing/try-strip").then((mod) => mod.TryStrip),
);

export default function LandingPage() {
  return (
    <>
      {/* Hero — the live wire */}
      <section className="border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
          <Link
            href={LATEST_RELEASE.href}
            className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
          >
            <span className="font-mono font-semibold text-tok-key">v{LATEST_RELEASE.version}</span>
            <span className="truncate">{LATEST_RELEASE.summary}</span>
            <span aria-hidden>→</span>
          </Link>
          <p className="eyebrow mb-3">URL ⇄ QuerySpec ⇄ rows</p>
          <h1 className="max-w-2xl font-mono text-2xl font-semibold leading-snug tracking-tight sm:text-[2rem]">
            {HEADLINE}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            Type-safe filtering, progressive multi-sort and pagination in one canonical,
            backend-safe <span className="font-mono text-sm">QuerySpec</span>. Zero dependencies ·
            7.6 kB · never throws.
          </p>

          <div className="mt-8">
            <HeroDemo />
          </div>

          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <InstallTabs />
            <dl className="flex gap-6">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-xs text-ink-muted">{stat.label}</dt>
                  <dd className="font-mono text-lg font-semibold">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <Section eyebrow="sort · parse · canonicalize · guards" title="Try the semantics">
        <TryStrip />
      </Section>

      <Section eyebrow="createQuery({ fields, stableBy, guards })" title="What the contract gives you">
        <FeatureGrid />
      </Section>

      <Section eyebrow="the bridge, not a competitor" title="One spec everyone agrees on">
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-ink-muted">
          querypipe doesn&rsquo;t compete with nuqs, TanStack Table or your ORM — it&rsquo;s the
          typed contract between them. It manages the query, never the data.
        </p>
        <BridgeTable />
      </Section>

      <Section eyebrow="parse → 400 | findMany" title="The server side">
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-ink-muted">
          The inbound boundary is one call. Everything that comes back ok is whitelisted,
          guard-limited and injection-safe by construction; everything else is a ready-made 400
          body.
        </p>
        <ServerStory />
      </Section>

      <Section eyebrow="v0.2 → v0.3 → java" title="Where this is going">
        <RoadmapTeaser />
        <div className="mt-8 border-t border-line pt-6">
          <h3 className="mb-2 text-[15px] font-semibold">Get an email when v0.2 adapters land</h3>
          <NewsletterForm enabled={Boolean(process.env.NEWSLETTER_API_KEY)} />
        </div>
      </Section>

      <script
        type="application/ld+json"
        // JSON-LD for the library itself; static content, no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
      />

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-3 px-4 py-10 sm:px-6">
          <p className="text-sm text-ink-muted">
            Read the docs, or open the playground — its URL state is managed by querypipe itself.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/docs"
              className="rounded-lg border border-tok-key/50 bg-tok-key/10 px-4 py-2 text-sm font-medium text-tok-key transition-colors hover:bg-tok-key/20"
            >
              Read the docs
            </Link>
            <Link
              href="/playground"
              className="rounded-lg border border-line px-4 py-2 text-sm transition-colors hover:border-ink-muted"
            >
              Open the playground
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h2 className="mb-6 text-xl font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: "querypipe",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    codeRepository: GITHUB_URL,
    programmingLanguage: "TypeScript",
    runtimePlatform: "Node.js >= 18.17",
    license: "https://opensource.org/licenses/MIT",
    version: LATEST_RELEASE.version,
  };
}
