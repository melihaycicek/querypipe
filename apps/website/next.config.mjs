// ESM on purpose: fumadocs-mdx loads the compiled source config with a
// dynamic import, which breaks when Next transpiles a TS config to CJS.
import { createMDX } from "fumadocs-mdx/next";
import { fileURLToPath } from "node:url";

const withMDX = createMDX();

const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Builds run webpack (`next build --webpack`): fumadocs-mdx 15's meta-json
 * loader trips over Turbopack's builtin JSON transform on Next 16.2.
 * @type {import('next').NextConfig}
 */
const config = {
  reactStrictMode: true,
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    // Monorepo root — a lockfile in an ancestor directory otherwise wins the
    // workspace-root inference.
    root: monorepoRoot,
  },
};

export default withMDX(config);
