import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VectorFile } from "./types";

/** Works from src (vitest ESM), dist ESM and dist CJS (tsup shims). */
function packageDir(): string {
  const here =
    typeof __dirname === "string" ? __dirname : fileURLToPath(new URL(".", import.meta.url));
  return join(here, "..");
}

export function defaultVectorsDir(): string {
  return join(packageDir(), "vectors");
}

export function loadVectorFiles(dir: string = defaultVectorsDir()): VectorFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const file = JSON.parse(readFileSync(join(dir, name), "utf8")) as VectorFile;
      if (typeof file.suite !== "string" || !Array.isArray(file.cases)) {
        throw new Error(`invalid vector file: ${name}`);
      }
      return file;
    });
}
