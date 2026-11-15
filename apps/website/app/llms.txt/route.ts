import { source } from "@/lib/source";
import { SITE_URL } from "@/lib/site";

/** Plain-text site map + API summary for AI agents. Prerendered at build. */
export const dynamic = "force-static";

export function GET(): Response {
  const pages = source
    .getPages()
    .map(
      (page) =>
        `- [${page.data.title}](${SITE_URL}${page.url}): ${page.data.description ?? ""}` +
        ` (raw markdown: ${SITE_URL}/docs-md${page.url.replace(/^\/docs/, "") || "/index"})`,
    )
    .join("\n");

  const text = `# querypipe

> A typed query behavior engine for filtering, progressive multi-sorting, pagination and backend-safe query generation. One type-safe QuerySpec bridging URL state, table UI state and backend execution. Zero dependencies, ESM + CJS, ≈7.6 kB min+gzip, MIT, v0.1.1.

- Install: npm install querypipe
- GitHub: https://github.com/melihaycicek/querypipe
- npm: https://www.npmjs.com/package/querypipe
- Playground (state lives in the URL as a querypipe canonical string): ${SITE_URL}/playground

## Public API (frozen, v0.1)

Runtime exports: createQuery · numberField stringField dateField booleanField enumField customField · parseQuery stringifyQuery validateQuerySpec canonicalize applyQuery · isOk isErr
Type exports: QuerySpec SortCondition FilterNode FilterCondition FilterGroup Operator QueryError QueryErrorCode FieldSchema QueryResult
Builder methods: filter · removeFilter · clearFilters · sort · thenSort · insertSortAfter · removeSort · toggleSortDirection · clearSorts · limit · offset · cursor · withSpec · toSpec · stringify · parse · apply
Operators: eq neq gt gte lt lte in notIn between contains startsWith endsWith isNull notNull (root-level AND; contains/startsWith/endsWith are literal, never patterns; isNull/notNull take no value)
Error codes: UNKNOWN_FIELD NOT_SORTABLE NOT_FILTERABLE INVALID_OPERATOR INVALID_VALUE MAX_SORT_EXCEEDED MAX_FILTER_EXCEEDED VALUE_TOO_LONG CONFLICTING_PAGINATION
Errors carry { code, field?, op?, message, position? } — position is a 0-based index into the parse input. parse/validate never throw; only schema/builder misuse throws TypeError.

## Canonical string format

Segments joined by "&" in fixed order: sort= → filter= → offset= → limit= → cursor= → version=.
sort items: field:direction[:nullsfirst|nullslast] (comma-separated; wire position = priority).
filter items: field:op[:values] (semicolon-separated; values comma-separated).
Escape set (values only, uppercase hex): % , ; : & = — "+" and space are literal.
Example: sort=price:desc,name:asc&filter=price:between:1000,5000;deletedAt:isNull

## Docs

${pages}
`;

  return new Response(text, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
