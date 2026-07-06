import type {
  BaseFieldOptions,
  BooleanFieldOptions,
  CustomFieldOptions,
  DateFieldOptions,
  DateInput,
  EnumFieldOptions,
  FieldKind,
  FieldSchema,
  NumberFieldOptions,
  ResolvedFlag,
  StringFieldOptions,
} from "./types";

/**
 * Field schema DSL. Constructors carry the sortable/filterable flags and the
 * kind as literal types so the builder can narrow field names and
 * operator/value pairs at compile time; at runtime they produce the plain
 * frozen objects `createQuery` ingests.
 */

function makeField(
  type: FieldKind,
  options: (BaseFieldOptions & { readonly schema?: unknown }) | undefined,
  extras?: Record<string, unknown>,
): never {
  const o = (options ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {
    type,
    sortable: o.sortable !== false,
    filterable: o.filterable !== false,
  };
  if (o.alias !== undefined) out.alias = o.alias;
  if (o.schema !== undefined) out.schema = o.schema;
  if (extras !== undefined) Object.assign(out, extras);
  return Object.freeze(out) as never;
}

export function numberField<const O extends NumberFieldOptions = {}>(
  options?: O,
): FieldSchema<number, ResolvedFlag<O, "sortable">, ResolvedFlag<O, "filterable">, "number"> {
  return makeField("number", options);
}

export function stringField<const O extends StringFieldOptions = {}>(
  options?: O,
): FieldSchema<string, ResolvedFlag<O, "sortable">, ResolvedFlag<O, "filterable">, "string"> {
  const extras: Record<string, unknown> = {};
  if (options?.locale !== undefined) extras.locale = options.locale;
  if (options?.sensitivity !== undefined) extras.sensitivity = options.sensitivity;
  return makeField("string", options, extras);
}

export function dateField<const O extends DateFieldOptions = {}>(
  options?: O,
): FieldSchema<DateInput, ResolvedFlag<O, "sortable">, ResolvedFlag<O, "filterable">, "date"> {
  return makeField("date", options);
}

export function booleanField<const O extends BooleanFieldOptions = {}>(
  options?: O,
): FieldSchema<boolean, ResolvedFlag<O, "sortable">, ResolvedFlag<O, "filterable">, "boolean"> {
  return makeField("boolean", options);
}

/** Value type narrows to the literal union of `values`; comparison order is declaration order (ADR-0008 §3). */
export function enumField<
  const V extends readonly [string, ...string[]],
  const O extends EnumFieldOptions = {},
>(
  values: V,
  options?: O,
): FieldSchema<V[number], ResolvedFlag<O, "sortable">, ResolvedFlag<O, "filterable">, "enum"> {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.some((v) => typeof v !== "string") ||
    new Set(values).size !== values.length
  ) {
    throw new TypeError("enumField: non-empty unique string values required");
  }
  return makeField("enum", options, { values: Object.freeze([...values]) });
}

export function customField<T, const O extends BaseFieldOptions = {}>(
  options: O & CustomFieldOptions<T>,
): FieldSchema<T, ResolvedFlag<O, "sortable">, ResolvedFlag<O, "filterable">, "custom"> {
  if (options === null || typeof options !== "object" || typeof options.comparator !== "function") {
    throw new TypeError("customField: comparator function required");
  }
  return makeField("custom", options, { comparator: options.comparator });
}
