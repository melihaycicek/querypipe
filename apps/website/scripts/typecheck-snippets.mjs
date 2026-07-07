/**
 * Extracts every ts/tsx fenced code block from content/docs/**\/*.mdx and
 * typechecks them against the real `querypipe` package (acceptance: docs
 * snippets must compile against the actual API).
 *
 * Blocks on one page are concatenated in order into one module, so later
 * blocks may use identifiers introduced earlier on the same page. Blocks
 * marked ```ts no-check``` are skipped (used for deliberate compile errors
 * and for snippets importing packages that are not website dependencies,
 * e.g. express or nuqs — those are mirrored from the runnable examples/ apps
 * which are themselves typechecked in the monorepo).
 *
 * Run: node scripts/typecheck-snippets.mjs   (or: pnpm typecheck:snippets)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "content", "docs");
const tmpDir = join(root, "scripts", ".snippets-tmp");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".mdx")) out.push(full);
  }
  return out;
}

const FENCE = /```(\w+)([^\n]*)\n([\s\S]*?)```/g;

rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

const generated = [];
let blockCount = 0;

for (const file of walk(contentDir)) {
  const text = readFileSync(file, "utf8");
  const blocks = [];
  for (const match of text.matchAll(FENCE)) {
    const [, lang, meta, code] = match;
    if (lang !== "ts" && lang !== "tsx") continue;
    if (meta.includes("no-check")) continue;
    blocks.push(code);
    blockCount++;
  }
  if (blocks.length === 0) continue;
  const slug = relative(contentDir, file).replace(/[\\/]/g, "__").replace(/\.mdx$/, "");
  const outFile = join(tmpDir, `${slug}.ts`);
  writeFileSync(outFile, blocks.join("\n\n"), "utf8");
  generated.push(outFile);
}

console.log(`extracted ${blockCount} ts block(s) from ${generated.length} page(s)`);

if (generated.length === 0) process.exit(0);

try {
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "tsc",
      "--noEmit",
      "--strict",
      "--target",
      "es2022",
      "--lib",
      "es2022,dom",
      "--module",
      "esnext",
      "--moduleResolution",
      "bundler",
      "--skipLibCheck",
      ...generated,
    ],
    { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
  );
  console.log("snippets typecheck: OK");
} catch {
  console.error("snippets typecheck: FAILED");
  process.exit(1);
}
