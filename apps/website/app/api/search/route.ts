import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

/**
 * Static search: the Orama index is exported once at build time and served
 * as a static file; querying happens client-side (RootProvider is configured
 * with `type: "static"`). No server function involved.
 */
export const revalidate = false;

export const { staticGET: GET } = createFromSource(source);
