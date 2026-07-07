import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { ErrorAnatomyDemo } from "@/components/landing/error-anatomy-demo";
import { QueryTokenString } from "@/components/query-token-string";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    QueryTokenString,
    ErrorAnatomyDemo,
    ...components,
  };
}
