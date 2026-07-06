import { describe, it } from "vitest";
import { coreEngine } from "../src/core-engine";
import { loadVectorFiles } from "../src/loader";
import { runVectorCase } from "../src/runner";

/**
 * The conformance suite: every JSON vector file executed against
 * querypipe through the language-independent engine seam. These same
 * files are the acceptance suite for querypipe-java.
 */
for (const file of loadVectorFiles()) {
  describe(`vectors/${file.suite}`, () => {
    for (const c of file.cases) {
      it(c.name, () => {
        const result = runVectorCase(coreEngine, file, c);
        if (!result.pass) throw new Error(result.message);
      });
    }
  });
}
