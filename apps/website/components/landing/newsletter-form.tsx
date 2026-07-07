"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "success" | "error";

export function NewsletterForm({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  if (!enabled) {
    return (
      <p className="text-sm text-ink-muted">
        Newsletter signup is not enabled yet. Watch{" "}
        <a
          href="https://github.com/melihaycicek/querypipe"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          the GitHub repo
        </a>{" "}
        for releases in the meantime.
      </p>
    );
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          company: data.get("company"), // honeypot — humans leave it empty
        }),
      });
      const body = (await response.json()) as { message?: string };
      if (response.ok) {
        setStatus("success");
        setMessage("Subscribed. You'll get an email when v0.2 adapters land.");
        form.reset();
      } else {
        setStatus("error");
        setMessage(body.message ?? "Something went wrong — please try again later.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error — please try again later.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex max-w-md gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-tok-key/70"
        />
        {/* Honeypot: hidden from humans, tempting to bots. */}
        <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
          <label>
            Company
            <input name="company" type="text" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <button
          type="submit"
          disabled={status === "sending"}
          className="shrink-0 rounded-lg border border-tok-key/50 bg-tok-key/10 px-4 py-2 text-sm font-medium text-tok-key transition-colors hover:bg-tok-key/20 disabled:opacity-60"
        >
          {status === "sending" ? "Subscribing…" : "Get release notes"}
        </button>
      </div>
      <p className="text-xs text-ink-muted">Release notes only. No spam, unsubscribe anytime.</p>
      {status === "success" || status === "error" ? (
        <p
          role="status"
          className={`text-sm ${status === "success" ? "text-tok-value" : "text-tok-err"}`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
