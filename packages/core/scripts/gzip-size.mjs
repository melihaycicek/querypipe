import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// Enforced regression gate. The original 6 KiB target is not reachable in
// v0.1 without dropping contractual behavior (multi-error collection,
// position tracking, construction-misuse TypeErrors, deep-frozen specs) —
// decision + shrink candidates recorded in ADR-0003 §Consequences. Measured
// v0.1.0: ~7.4 KiB min+gzip (terser); v0.1.1: ~7.6 KiB (ADR-0012).
const BUDGET = 8 * 1024;

const source = readFileSync(new URL("../.size/index.js", import.meta.url));
const gzipped = gzipSync(source, { level: 9 }).length;

console.log(`querypipe minified: ${source.length} B, gzip: ${gzipped} B (budget ${BUDGET} B)`);
if (gzipped >= BUDGET) {
  console.error(`Bundle size budget exceeded: ${gzipped} B >= ${BUDGET} B`);
  process.exit(1);
}
