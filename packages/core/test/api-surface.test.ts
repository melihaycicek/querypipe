import { expect, it } from "vitest";
import * as core from "../src/index";

// The frozen public runtime surface — exactly these 14, nothing else.
const RUNTIME_EXPORTS = [
  "applyQuery",
  "booleanField",
  "canonicalize",
  "createQuery",
  "customField",
  "dateField",
  "enumField",
  "isErr",
  "isOk",
  "numberField",
  "parseQuery",
  "stringField",
  "stringifyQuery",
  "validateQuerySpec",
].sort();

it("exports exactly the frozen public runtime surface", () => {
  expect(Object.keys(core).sort()).toEqual(RUNTIME_EXPORTS);
});
