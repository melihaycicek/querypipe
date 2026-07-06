import { defineConfig } from "tsup";

// Minified single-format build used only to measure the gzip size budget
// (terser: same class of minifier consumers' production bundlers apply).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  minify: "terser",
  dts: false,
  sourcemap: false,
  clean: true,
  target: "es2020",
  treeshake: true,
  outDir: ".size",
});
