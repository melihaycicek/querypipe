# querypipe-website

The official landing page + docs site for [`querypipe`](https://www.npmjs.com/package/querypipe).
Private — never published; it depends on the library via `"querypipe": "workspace:*"` and does
not affect npm publishing of the core package in any way.

## Signature behaviors

- **Every demo runs the real library** in the browser — no mocked output anywhere. The
  server-side story panel's JSON is produced by running `parse` at build time.
- **Dogfooding:** the playground's state lives in the page URL as a querypipe canonical string
  (`?q=` + `encodeURIComponent(q.stringify())`, restored via `parse`).
- **One token color system** (`lib/palette.ts`) drives the hero input, playground, Shiki code
  themes and the OG image. `node scripts/contrast-check.mjs` verifies WCAG AA for all of it.

## Develop

```sh
pnpm install          # from the repo root
pnpm --filter querypipe-website dev
```

Builds run webpack (`next build --webpack`): fumadocs-mdx 15's meta-json loader currently trips
over Turbopack's builtin JSON transform on Next 16.2.

## Checks

```sh
pnpm --filter querypipe-website build               # also builds the lib first (prebuild)
pnpm --filter querypipe-website typecheck
pnpm --filter querypipe-website typecheck:snippets  # docs code blocks vs the real API
node scripts/contrast-check.mjs                     # WCAG AA for the token palette
```

## Environment

| Var | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | recommended | Canonical origin for metadata/sitemap/OG (defaults to `https://querypipe.dev`). |
| `NEWSLETTER_API_KEY` | no | Buttondown API key. Absent → the form renders disabled and the build still passes. |

## Deploy (Vercel)

- Root directory: `apps/website`
- Framework preset: Next.js · Install command: `pnpm install` · Build command: `pnpm build`
- Output: Next.js default
- Everything is static except `POST /api/subscribe` and the OG image routes.
