import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Exactly what this site does and doesn't collect. No tracking cookies.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow mb-2">no surprises</p>
      <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-ink-muted">
        <section>
          <h2 className="mb-1.5 font-semibold text-ink">What is collected</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-ink">Cookieless analytics</strong> (Vercel Analytics):
              aggregate page views and Web Vitals. No cookies are set, no identifier persists
              across visits, no cross-site tracking, and IP addresses are not stored.
            </li>
            <li>
              <strong className="text-ink">Newsletter email</strong> — only if you submit the
              form, and only your email address. It goes to the newsletter provider (Buttondown)
              for release notes; unsubscribe anytime. If the form shows &ldquo;not enabled
              yet&rdquo;, nothing is sent anywhere.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1.5 font-semibold text-ink">What is not collected</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>No tracking cookies. No advertising or fingerprinting scripts.</li>
            <li>
              Everything you type into the demos and playground runs the querypipe library{" "}
              <em>locally in your browser</em> — queries are never sent to a server. The
              playground stores your current query in the page URL only, so it&rsquo;s shareable
              by you, on purpose.
            </li>
            <li>Your theme preference lives in your browser&rsquo;s localStorage and never leaves it.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1.5 font-semibold text-ink">The consent banner</h2>
          <p>
            This site ships a consent manager that only appears if a consent-requiring feature
            is ever enabled. Since none is, you&rsquo;ll never see it — a cookie banner on a
            site that sets no tracking cookies would be noise.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 font-semibold text-ink">Contact</h2>
          <p>
            Questions? Open an issue on{" "}
            <a
              href="https://github.com/melihaycicek/querypipe/issues"
              target="_blank"
              rel="noreferrer"
              className="text-tok-key underline-offset-4 hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
