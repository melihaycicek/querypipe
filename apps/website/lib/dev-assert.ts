/**
 * Development-only assertions verifying the behaviors the demos claim, by
 * running the real package. Called once from the hero and the playground in
 * dev; compiled out of production bundles by the NODE_ENV guard.
 */
import { canonicalize, isErr, isOk } from "querypipe";
import { CANONICALIZE_DEMO_INPUT, PRODUCTS, products } from "./demo-schema";

let ran = false;

export function runDevAssertions(): void {
  if (process.env.NODE_ENV === "production" || ran) return;
  ran = true;

  const check = (name: string, ok: boolean) => {
    if (!ok) console.error(`[querypipe-website dev assertion failed] ${name}`);
  };

  // sort() resets the chain.
  const reset = products.sort("price", "desc").thenSort("name").sort("rating");
  check(
    "sort(field) resets the sort chain",
    reset.toSpec().sorts.length === 1 && reset.toSpec().sorts[0]!.field === "rating",
  );

  // thenSort() appends without touching existing priorities.
  const chained = products.sort("price", "desc").thenSort("name");
  const [first, second] = chained.toSpec().sorts;
  check(
    "thenSort(field) appends to the existing chain",
    first?.field === "price" && first?.priority === 1 && second?.field === "name" && second?.priority === 2,
  );

  // toggleSortDirection() flips in place, priority kept.
  const toggled = chained.toggleSortDirection("price").toSpec().sorts[0];
  check(
    "toggleSortDirection(field) flips direction, keeps priority",
    toggled?.field === "price" && toggled?.direction === "asc" && toggled?.priority === 1,
  );

  // isNull carries no value in the spec.
  const nullCond = products.filter("deletedAt", "isNull").toSpec().filters[0];
  check(
    'filter("deletedAt", "isNull") has no value',
    nullCond?.kind === "condition" && !("value" in nullCond),
  );

  // Invalid fields return structured errors, never throw.
  const bad = products.parse("sort=nope:asc");
  check(
    "invalid fields return structured errors",
    isErr(bad) && bad.errors[0]?.code === "UNKNOWN_FIELD",
  );

  // canonicalize is idempotent.
  const once = canonicalize(products, CANONICALIZE_DEMO_INPUT);
  const twice = isOk(once) ? canonicalize(products, once.value) : once;
  check(
    "canonicalize is idempotent",
    isOk(once) && isOk(twice) && once.value === twice.value,
  );

  // apply() does not mutate the original rows.
  const snapshot = JSON.stringify(PRODUCTS);
  products.sort("name").apply(PRODUCTS);
  check("apply(rows) does not mutate the input", JSON.stringify(PRODUCTS) === snapshot);
}
