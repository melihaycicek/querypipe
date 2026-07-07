import {
  HERO_DEFAULT_INPUT,
  PRODUCT_COLUMNS,
  PRODUCTS,
  TASK_COLUMNS,
  TASKS,
  products,
  tasks,
  type Product,
  type Task,
} from "@/lib/demo-schema";

export type PresetId = "products" | "tasks";

export interface FieldMeta {
  name: string;
  kind: "number" | "string" | "date" | "boolean" | "enum";
  sortable: boolean;
  filterable: boolean;
  enumValues?: readonly string[];
}

/**
 * UI metadata for the two playground schemas. This mirrors the schema
 * declarations in lib/demo-schema.ts — the source of truth for validity is
 * still the library itself (withSpec/parse), never these lists.
 */
export interface PresetConfig {
  id: PresetId;
  label: string;
  query: typeof products | typeof tasks;
  rows: readonly (Product | Task)[];
  columns: readonly { field: string; label: string }[];
  defaultInput: string;
  fields: readonly FieldMeta[];
}

export const PRESETS: Record<PresetId, PresetConfig> = {
  products: {
    id: "products",
    label: "products",
    query: products,
    rows: PRODUCTS,
    columns: PRODUCT_COLUMNS,
    defaultInput: HERO_DEFAULT_INPUT,
    fields: [
      { name: "id", kind: "number", sortable: true, filterable: true },
      { name: "name", kind: "string", sortable: true, filterable: true },
      { name: "price", kind: "number", sortable: true, filterable: true },
      { name: "category", kind: "enum", sortable: true, filterable: true, enumValues: ["phone", "laptop", "tablet"] },
      { name: "rating", kind: "number", sortable: true, filterable: true },
      { name: "reviewCount", kind: "number", sortable: true, filterable: true },
      { name: "stock", kind: "number", sortable: true, filterable: true },
      { name: "createdAt", kind: "date", sortable: true, filterable: true },
      { name: "deletedAt", kind: "date", sortable: true, filterable: true },
      { name: "secret", kind: "string", sortable: false, filterable: false },
    ],
  },
  tasks: {
    id: "tasks",
    label: "tasks",
    query: tasks,
    rows: TASKS,
    columns: TASK_COLUMNS,
    defaultInput: "sort=priority:asc,dueAt:asc&filter=status:neq:done;archivedAt:isNull",
    fields: [
      { name: "id", kind: "number", sortable: true, filterable: true },
      { name: "title", kind: "string", sortable: true, filterable: true },
      { name: "status", kind: "enum", sortable: true, filterable: true, enumValues: ["open", "in_progress", "done"] },
      { name: "priority", kind: "number", sortable: true, filterable: true },
      { name: "assignee", kind: "string", sortable: true, filterable: true },
      { name: "dueAt", kind: "date", sortable: true, filterable: true },
      { name: "archivedAt", kind: "date", sortable: true, filterable: true },
    ],
  },
};

/** Operators offered per field kind — mirrors the operator applicability table. */
export function operatorsForKind(kind: FieldMeta["kind"]): readonly string[] {
  const base = ["eq", "neq", "gt", "gte", "lt", "lte", "between", "in", "notIn"];
  const stringy = ["contains", "startsWith", "endsWith"];
  const nulls = ["isNull", "notNull"];
  if (kind === "string" || kind === "enum") return [...base, ...stringy, ...nulls];
  return [...base, ...nulls];
}
