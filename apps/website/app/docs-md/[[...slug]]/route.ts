import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { source } from "@/lib/source";

/**
 * Raw markdown for each docs page (for AI agents; linked from /llms.txt).
 * Files are read from content/docs at build time — force-static + params.
 */
export const dynamic = "force-static";

export function generateStaticParams(): Array<{ slug: string[] }> {
  return source.generateParams().map((params) => ({
    slug: params.slug && params.slug.length > 0 ? params.slug : ["index"],
  }));
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ slug?: string[] }> },
): Promise<Response> {
  const { slug } = await props.params;
  const parts = !slug || slug.length === 0 || (slug.length === 1 && slug[0] === "index")
    ? ["index"]
    : slug;

  // Only serve files that correspond to an actual docs page.
  const page = source.getPage(parts[0] === "index" && parts.length === 1 ? [] : parts);
  if (!page) notFound();

  const filePath = path.join(process.cwd(), "content", "docs", ...parts) + ".mdx";
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    notFound();
  }

  return new Response(text, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
