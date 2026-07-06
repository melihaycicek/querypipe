import { deepEqual, jsonNormalize } from "./deep-equal";
import type {
  ErrorMatcher,
  JsonError,
  JsonResult,
  VectorCase,
  VectorEngine,
  VectorFile,
} from "./types";

export interface CaseResult {
  readonly pass: boolean;
  readonly message?: string;
}

const pass: CaseResult = { pass: true };

function fail(caseName: string, message: string): CaseResult {
  return { pass: false, message: `[${caseName}] ${message}` };
}

function show(value: unknown): string {
  return JSON.stringify(value);
}

/** Execute one vector case against an engine (semantics: docs/spec/test-vectors.md). */
export function runVectorCase(engine: VectorEngine, file: VectorFile, c: VectorCase): CaseResult {
  const schema = file.schema;
  switch (c.op) {
    case "parse":
      return matchResult(c, engine.parse(schema, c.input as string));
    case "stringify":
      return matchResult(c, engine.stringify(schema, c.spec));
    case "canonicalize": {
      const result = matchResult(c, engine.canonicalize(schema, c.input as string));
      if (!result.pass) return result;
      const canonical = c.expect?.output;
      if (c.expect?.ok !== false && typeof canonical === "string") {
        // Law 1b: canonicalization is idempotent — re-canonicalizing the output is identity.
        const again = engine.canonicalize(schema, canonical);
        if (!again.ok || again.value !== canonical) {
          return fail(c.name, `canonicalization is not idempotent: ${show(again)} !== ${show(canonical)}`);
        }
      }
      return pass;
    }
    case "validate": {
      const result = engine.validate(schema, c.spec);
      if (c.expect?.ok === false) return matchResult(c, result);
      if (!result.ok) return fail(c.name, `expected ok, got errors ${show(result.errors)}`);
      if (!deepEqual(jsonNormalize(result.value), jsonNormalize(c.spec))) {
        return fail(c.name, `validate must return the input spec unchanged; got ${show(result.value)}`);
      }
      return pass;
    }
    case "apply": {
      const result = engine.apply(schema, c.spec, c.rows ?? []);
      if (c.expect?.ok === false) return matchResult(c, result);
      if (!result.ok) return fail(c.name, `expected ok, got errors ${show(result.errors)}`);
      const rows = result.value as ReadonlyArray<Record<string, unknown>>;
      if (c.expect?.ids !== undefined) {
        const idField = file.idField ?? "id";
        const ids = rows.map((row) => row[idField]);
        if (!deepEqual(jsonNormalize(ids), jsonNormalize(c.expect.ids))) {
          return fail(c.name, `ids mismatch: got ${show(ids)}, expected ${show(c.expect.ids)}`);
        }
      }
      if (c.expect?.rows !== undefined) {
        if (!deepEqual(jsonNormalize(rows), jsonNormalize(c.expect.rows))) {
          return fail(c.name, `rows mismatch: got ${show(rows)}, expected ${show(c.expect.rows)}`);
        }
      }
      return pass;
    }
    case "roundtrip-spec": {
      // Law 1a: parse(stringify(spec)) deep-equals every canonical spec.
      const s = engine.stringify(schema, c.spec);
      if (!s.ok) return fail(c.name, `stringify failed: ${show(s.errors)}`);
      if (c.expect?.output !== undefined && s.value !== c.expect.output) {
        return fail(c.name, `canonical string mismatch: got ${show(s.value)}, expected ${show(c.expect.output)}`);
      }
      const p = engine.parse(schema, s.value as string);
      if (!p.ok) return fail(c.name, `re-parse failed: ${show(p.errors)}`);
      if (!deepEqual(jsonNormalize(p.value), jsonNormalize(c.spec))) {
        return fail(c.name, `round-trip diverged: got ${show(p.value)}, expected ${show(c.spec)}`);
      }
      return pass;
    }
    default:
      return fail(c.name, `unknown case op "${String(c.op)}"`);
  }
}

function matchResult(c: VectorCase, result: JsonResult): CaseResult {
  const expect = c.expect;
  if (expect === undefined) return fail(c.name, `case has no expectation`);

  const expectOk = expect.ok !== false && expect.errors === undefined;
  if (expectOk) {
    if (!result.ok) return fail(c.name, `expected ok, got errors ${show(result.errors)}`);
    if (expect.spec !== undefined && !deepEqual(jsonNormalize(result.value), jsonNormalize(expect.spec))) {
      return fail(c.name, `spec mismatch: got ${show(result.value)}, expected ${show(expect.spec)}`);
    }
    if (expect.output !== undefined && result.value !== expect.output) {
      return fail(c.name, `output mismatch: got ${show(result.value)}, expected ${show(expect.output)}`);
    }
    return pass;
  }

  if (result.ok) return fail(c.name, `expected errors ${show(expect.errors)}, got ok ${show(result.value)}`);
  return matchErrors(c, expect.errors ?? [], result.errors);
}

function matcherFits(matcher: ErrorMatcher, error: JsonError): boolean {
  if (matcher.code !== error.code) return false;
  if (matcher.field !== undefined && matcher.field !== error.field) return false;
  if (matcher.op !== undefined && matcher.op !== error.op) return false;
  if (matcher.position !== undefined && matcher.position !== error.position) return false;
  return true;
}

function matchErrors(
  c: VectorCase,
  matchers: readonly ErrorMatcher[],
  actual: readonly JsonError[],
): CaseResult {
  const exact = c.exactErrors !== false;
  if (exact && actual.length !== matchers.length) {
    return fail(c.name, `expected exactly ${matchers.length} error(s), got ${actual.length}: ${show(actual)}`);
  }
  const used = new Set<number>();
  for (const matcher of matchers) {
    const idx = actual.findIndex((error, i) => !used.has(i) && matcherFits(matcher, error));
    if (idx < 0) {
      return fail(c.name, `no error matches ${show(matcher)} in ${show(actual)}`);
    }
    used.add(idx);
  }
  return pass;
}
