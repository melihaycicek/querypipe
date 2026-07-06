import type { FieldKind, Operator } from "./types";

export type OpArity = "none" | "one" | "two" | "many";

/** Kinds accepting valued operators; custom is null-checks-only in v0.1 (ADR-0008 §6). */
const VALUED: readonly FieldKind[] = ["number", "string", "date", "boolean", "enum"];
const STRINGY: readonly FieldKind[] = ["string", "enum"];
const ALL: readonly FieldKind[] = ["number", "string", "date", "boolean", "enum", "custom"];

export interface OperatorMeta {
  readonly arity: OpArity;
  readonly kinds: readonly FieldKind[];
}

export const OPERATORS: Readonly<Record<Operator, OperatorMeta>> = {
  eq: { arity: "one", kinds: VALUED },
  neq: { arity: "one", kinds: VALUED },
  gt: { arity: "one", kinds: VALUED },
  gte: { arity: "one", kinds: VALUED },
  lt: { arity: "one", kinds: VALUED },
  lte: { arity: "one", kinds: VALUED },
  in: { arity: "many", kinds: VALUED },
  notIn: { arity: "many", kinds: VALUED },
  between: { arity: "two", kinds: VALUED },
  contains: { arity: "one", kinds: STRINGY },
  startsWith: { arity: "one", kinds: STRINGY },
  endsWith: { arity: "one", kinds: STRINGY },
  isNull: { arity: "none", kinds: ALL },
  notNull: { arity: "none", kinds: ALL },
};

export function isOperator(token: string): token is Operator {
  return Object.prototype.hasOwnProperty.call(OPERATORS, token);
}

/**
 * String operators take a plain substring fragment: the value domain is
 * "string", independent of the field's kind (an enum field's contains value
 * need not be an enum member). Value-domain hooks (Standard Schema) do not
 * run on fragments.
 */
export function isStringOp(op: string): boolean {
  return op === "contains" || op === "startsWith" || op === "endsWith";
}
