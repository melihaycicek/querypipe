/**
 * WCAG AA check for the token palette: every token color and foreground must
 * reach ≥ 4.5:1 against both backgrounds of its theme. Run: node scripts/contrast-check.mjs
 * Exits 1 on any failure so it can gate CI if desired.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// palette.ts is plain data — extract hex values without a TS toolchain.
const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "palette.ts"),
  "utf8",
);

function extractTheme(name) {
  const block = src.split(`export const ${name}`)[1].split("};")[0];
  const entries = [...block.matchAll(/(\w+):\s*"(#[0-9A-Fa-f]{6})"/g)];
  const flat = {};
  for (const [, key, hex] of entries) flat[key] = flat[key] ?? hex; // first wins (bg before tok dups — none expected)
  return flat;
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

let failed = false;
for (const themeName of ["dark", "light"]) {
  const t = extractTheme(themeName);
  const backgrounds = { bg: t.bg, bgElev: t.bgElev };
  const colors = ["fg", "fgMuted", "key", "field", "op", "value", "sep", "err"];
  for (const [bgName, bgHex] of Object.entries(backgrounds)) {
    for (const name of colors) {
      const r = ratio(t[name], bgHex);
      const ok = r >= 4.5;
      if (!ok) failed = true;
      console.log(
        `${ok ? "PASS" : "FAIL"} ${themeName}.${name} ${t[name]} on ${bgName} ${bgHex} = ${r.toFixed(2)}:1`,
      );
    }
  }
}
process.exit(failed ? 1 : 0);
