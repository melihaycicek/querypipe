import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";
import { tokenCssVariables, dark, light } from "@/lib/palette";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/site";
import { ConsentBanner } from "@/components/consent-banner";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — querypipe",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: "querypipe",
    type: "website",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: light.bg },
    { media: "(prefers-color-scheme: dark)", color: dark.bg },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${hanken.variable} ${plexMono.variable}`}>
      <head>
        {/* Palette custom properties, generated from lib/palette.ts so CSS,
            Shiki themes and the OG image can never drift apart. */}
        <style dangerouslySetInnerHTML={{ __html: tokenCssVariables() }} />
      </head>
      <body className="font-sans antialiased">
        <RootProvider
          search={{
            // Static search: the index is prerendered by /api/search (staticGET)
            // and queried client-side — no server function involved.
            options: { type: "static" },
          }}
        >
          {children}
        </RootProvider>
        <ConsentBanner />
        <Analytics />
      </body>
    </html>
  );
}
