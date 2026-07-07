/** Site-wide constants. Claims here must be true of querypipe v0.1.0. */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://querypipe.dev").replace(
  /\/$/,
  "",
);

export const GITHUB_URL = "https://github.com/melihaycicek/querypipe";
export const NPM_URL = "https://www.npmjs.com/package/querypipe";

export const SITE_NAME = "querypipe";
export const SITE_TITLE = "querypipe — one typed query contract from URL to database";
export const SITE_DESCRIPTION =
  "Type-safe filtering, progressive multi-sort and pagination in one canonical, backend-safe QuerySpec. Zero dependencies · 7.4 kB · never throws.";

export const HEADLINE = "One typed contract from URL to database.";

export const STATS = [
  { value: "0", label: "dependencies" },
  { value: "≈7.4 kB", label: "min+gzip" },
  { value: "182", label: "conformance tests" },
] as const;

export const INSTALL_COMMANDS = {
  npm: "npm install querypipe",
  pnpm: "pnpm add querypipe",
  yarn: "yarn add querypipe",
  bun: "bun add querypipe",
} as const;

/**
 * Consent-requiring features (tracking cookies etc.). The site sets none, so
 * the consent banner never renders while this is false. Flip it only if a
 * consent-requiring integration is ever added.
 */
export const CONSENT_REQUIRED = false;
