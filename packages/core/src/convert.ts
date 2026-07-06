import type { InternalField, StandardSchemaResult, StandardSchemaV1 } from "./types";

/** Strict decimal — no exponent, no NaN/Infinity (ADR-0011 §2). */
const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** ISO-8601 datetime with mandatory Z/offset (ADR-0011 §3). */
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export function isValidDateString(value: string): boolean {
  return (
    (DATE_ONLY_RE.test(value) || DATE_TIME_RE.test(value)) && !Number.isNaN(Date.parse(value))
  );
}

/** A JS number whose canonical rendering survives the string grammar. */
export function isCanonicalNumber(value: number): boolean {
  return Number.isFinite(value) && !String(value).includes("e");
}

export type Converted = { ok: true; value: unknown } | { ok: false; reason: string };

const pass = (value: unknown): Converted => ({ ok: true, value });
const nope = (reason: string): Converted => ({ ok: false, reason });

/**
 * Shared value coercion core. `fromToken` selects the string-format ingress
 * (decoded tokens, converted to the kind's domain) versus the JSON ingress
 * (typed values, never coerced — ADR-0011 §1). date/enum rules are identical
 * on both paths by design.
 */
function coerce(field: InternalField, value: unknown, fromToken: boolean): Converted {
  switch (field.type) {
    case "number": {
      let n = value;
      if (fromToken) {
        if (!NUMBER_RE.test(value as string)) return nope("expected a canonical decimal number");
        n = Number(value);
      }
      return typeof n === "number" && isCanonicalNumber(n)
        ? pass(n)
        : nope("expected a canonical decimal number");
    }
    case "boolean":
      if (fromToken) return value === "true" || value === "false" ? pass(value === "true") : nope("expected true|false");
      return typeof value === "boolean" ? pass(value) : nope("expected true|false");
    case "date":
      return typeof value === "string" && isValidDateString(value)
        ? pass(value)
        : nope("expected an ISO date (Z/offset required)");
    case "enum":
      return typeof value === "string" && (field.values as readonly string[]).includes(value)
        ? pass(value)
        : nope(`expected one of: ${(field.values as readonly string[]).join(", ")}`);
    case "string":
      return typeof value === "string" ? pass(value) : nope("expected a string");
    case "custom":
      // Unreachable through parse (kind applicability blocks valued ops first).
      return nope("custom fields: null checks only in v0.1");
  }
}

/** Decoded string token → typed spec value, by field kind (string-format ingress). */
export function tokenToValue(field: InternalField, token: string): Converted {
  return coerce(field, token, true);
}

/** Typed JSON spec value check, by field kind (JSON wire ingress; never coerces). */
export function checkJsonValue(field: InternalField, value: unknown): Converted {
  return coerce(field, value, false);
}

/** The exact text stringify would emit for a value (also the guard-length basis, ADR-0006 §1). */
export function canonicalValueString(field: InternalField, value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export type SchemaRun = { ok: true; value: unknown } | { ok: false; reason: string };

/** Run a Standard Schema validator synchronously; never throws (ADR-0009). */
export function runStandardSchema(schema: StandardSchemaV1<unknown, unknown>, value: unknown): SchemaRun {
  let result: StandardSchemaResult<unknown> | Promise<StandardSchemaResult<unknown>>;
  try {
    result = schema["~standard"].validate(value);
  } catch {
    return { ok: false, reason: "validator threw" };
  }
  if (result && typeof (result as { then?: unknown }).then === "function") {
    return { ok: false, reason: "async validation unsupported in v0.1" };
  }
  const r = result as StandardSchemaResult<unknown>;
  if (r.issues) {
    const reason = r.issues.map((i) => i.message).join("; ");
    return { ok: false, reason: reason === "" ? "rejected by schema" : reason };
  }
  return { ok: true, value: r.value };
}
