"use client";

import { useEffect, useState } from "react";
import { CONSENT_REQUIRED } from "@/lib/site";

const STORAGE_KEY = "qp-consent";

/**
 * Minimal consent manager. The site uses cookieless analytics and sets no
 * tracking cookies, so `CONSENT_REQUIRED` is false and this renders nothing.
 * If a consent-requiring feature is ever enabled, flip the flag: the banner
 * appears bottom-left, the choice persists in localStorage, and /privacy
 * documents exactly what is collected.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!CONSENT_REQUIRED) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === null) setVisible(true);
    } catch {
      // storage unavailable — never block the page over a banner
    }
  }, []);

  if (!CONSENT_REQUIRED || !visible) return null;

  const decide = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Consent"
      className="panel fixed bottom-4 left-4 z-50 max-w-sm p-4 text-sm shadow-lg"
    >
      <p className="text-ink">
        An optional feature on this site would like to store data in your browser.{" "}
        <a href="/privacy" className="underline">
          What is collected
        </a>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => decide("accepted")}
          className="rounded-md bg-tok-key px-3 py-1.5 font-medium text-canvas"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => decide("rejected")}
          className="rounded-md border border-line px-3 py-1.5"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

/** True when the visitor accepted optional storage (always false while the flag is off). */
export function hasConsent(): boolean {
  if (!CONSENT_REQUIRED) return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "accepted";
  } catch {
    return false;
  }
}
