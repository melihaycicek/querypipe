/**
 * The schemas and datasets behind every live demo. All demo output on the
 * site comes from running the real `querypipe` package against these — no
 * mocked results anywhere.
 *
 * The data intentionally contains ties (equal prices, equal ratings with
 * equal review counts) so progressive sorting and the `stableBy` tie-breaker
 * are visibly meaningful, plus soft-deleted rows for `deletedAt:isNull`.
 */
import { createQuery, dateField, enumField, numberField, stringField } from "querypipe";

/* ------------------------------------------------------------------ *
 * Products preset (default)
 * ------------------------------------------------------------------ */

export const products = createQuery({
  fields: {
    id: numberField(),
    name: stringField(),
    price: numberField(),
    category: enumField(["phone", "laptop", "tablet"]),
    rating: numberField(),
    reviewCount: numberField(),
    stock: numberField(),
    createdAt: dateField(),
    deletedAt: dateField(),
    // Known to the schema but unreachable from the wire — powers the
    // NOT_SORTABLE / NOT_FILTERABLE error demos.
    secret: stringField({ sortable: false, filterable: false }),
  },
  stableBy: "id",
  guards: { maxSortColumns: 3 },
});

export interface Product {
  id: number;
  name: string;
  price: number;
  category: "phone" | "laptop" | "tablet";
  rating: number;
  reviewCount: number;
  stock: number;
  createdAt: string;
  deletedAt: string | null;
  [key: string]: unknown;
}

export const PRODUCTS: readonly Product[] = [
  { id: 1, name: "Aria 12", price: 999, category: "phone", rating: 4.6, reviewCount: 1284, stock: 42, createdAt: "2025-11-02", deletedAt: null },
  { id: 2, name: "Aria 12 Pro", price: 1299, category: "phone", rating: 4.8, reviewCount: 911, stock: 17, createdAt: "2025-11-02", deletedAt: null },
  { id: 3, name: "Aria Mini", price: 649, category: "phone", rating: 4.1, reviewCount: 208, stock: 0, createdAt: "2025-03-14", deletedAt: "2026-01-08" },
  { id: 4, name: "Blade 14", price: 1899, category: "laptop", rating: 4.8, reviewCount: 911, stock: 5, createdAt: "2025-08-19", deletedAt: null },
  { id: 5, name: "Blade 16", price: 2399, category: "laptop", rating: 4.9, reviewCount: 388, stock: 3, createdAt: "2025-08-19", deletedAt: null },
  { id: 6, name: "Blade 14 Air", price: 1899, category: "laptop", rating: 4.5, reviewCount: 640, stock: 11, createdAt: "2025-09-01", deletedAt: null },
  { id: 7, name: "Slate 11", price: 749, category: "tablet", rating: 4.3, reviewCount: 530, stock: 9, createdAt: "2025-06-30", deletedAt: null },
  { id: 8, name: "Slate 11 Max", price: 999, category: "tablet", rating: 4.3, reviewCount: 530, stock: 21, createdAt: "2025-06-30", deletedAt: null },
  { id: 9, name: "Slate 8", price: 449, category: "tablet", rating: 3.9, reviewCount: 102, stock: 0, createdAt: "2024-12-05", deletedAt: "2026-02-11" },
  { id: 10, name: "Aria 11", price: 899, category: "phone", rating: 4.6, reviewCount: 731, stock: 13, createdAt: "2024-10-21", deletedAt: null },
];

/** Columns rendered by the demo tables, in display order. */
export const PRODUCT_COLUMNS = [
  { field: "name", label: "Name" },
  { field: "category", label: "Category" },
  { field: "price", label: "Price" },
  { field: "rating", label: "Rating" },
  { field: "reviewCount", label: "Reviews" },
  { field: "stock", label: "Stock" },
] as const;

export type ProductSortField =
  | "id"
  | "name"
  | "price"
  | "category"
  | "rating"
  | "reviewCount"
  | "stock"
  | "createdAt"
  | "deletedAt";

/* ------------------------------------------------------------------ *
 * Tasks preset (playground alternative schema)
 * ------------------------------------------------------------------ */

export const tasks = createQuery({
  fields: {
    id: numberField(),
    title: stringField(),
    status: enumField(["open", "in_progress", "done"]),
    priority: numberField(),
    assignee: stringField(),
    dueAt: dateField(),
    archivedAt: dateField(),
  },
  stableBy: "id",
  guards: { maxSortColumns: 3 },
});

export interface Task {
  id: number;
  title: string;
  status: "open" | "in_progress" | "done";
  priority: number;
  assignee: string;
  dueAt: string;
  archivedAt: string | null;
  [key: string]: unknown;
}

export const TASKS: readonly Task[] = [
  { id: 1, title: "Ship wire-format spec", status: "done", priority: 1, assignee: "mira", dueAt: "2026-06-12", archivedAt: null },
  { id: 2, title: "Review parse errors", status: "in_progress", priority: 1, assignee: "jon", dueAt: "2026-07-08", archivedAt: null },
  { id: 3, title: "Draft adapter ADR", status: "in_progress", priority: 2, assignee: "mira", dueAt: "2026-07-08", archivedAt: null },
  { id: 4, title: "Fix escaping edge case", status: "open", priority: 1, assignee: "sam", dueAt: "2026-07-15", archivedAt: null },
  { id: 5, title: "Write keyset prototype", status: "open", priority: 3, assignee: "jon", dueAt: "2026-08-01", archivedAt: null },
  { id: 6, title: "Retire legacy parser", status: "done", priority: 2, assignee: "sam", dueAt: "2026-05-20", archivedAt: "2026-05-28" },
  { id: 7, title: "Benchmark stable sort", status: "open", priority: 2, assignee: "mira", dueAt: "2026-07-15", archivedAt: null },
  { id: 8, title: "Audit guard defaults", status: "open", priority: 2, assignee: "jon", dueAt: "2026-07-15", archivedAt: null },
];

export const TASK_COLUMNS = [
  { field: "title", label: "Title" },
  { field: "status", label: "Status" },
  { field: "priority", label: "Priority" },
  { field: "assignee", label: "Assignee" },
  { field: "dueAt", label: "Due" },
] as const;

/* ------------------------------------------------------------------ *
 * Shared demo inputs
 * ------------------------------------------------------------------ */

export const HERO_DEFAULT_INPUT =
  "sort=price:desc,name:asc&filter=price:between:1000,5000;deletedAt:isNull";

export const ERROR_DEMO_INPUT = "sort=secret:asc,nope:asc&filter=price:like:5";

export const CANONICALIZE_DEMO_INPUT = "limit=30&sort=price&filter=deletedAt:isNull";

/** Sortable fields used by the guards demo slider, in slider order. */
export const GUARD_DEMO_FIELDS = ["price", "rating", "name", "stock", "reviewCount", "id"] as const;
