import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { OG_SIZE, OgCard } from "@/lib/og-template";
import { loadOgFonts } from "@/lib/og-fonts";
import { HERO_DEFAULT_INPUT } from "@/lib/demo-schema";
import { source } from "@/lib/source";

/** Per-docs-page OG images, prerendered at build time. */
export const dynamic = "force-static";

export function generateStaticParams(): Array<{ slug: string[] }> {
  return source.generateParams().map((params) => {
    const slug = params.slug && params.slug.length > 0 ? [...params.slug] : ["index"];
    slug[slug.length - 1] = `${slug[slug.length - 1]}.png`;
    return { slug };
  });
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ slug: string[] }> },
): Promise<Response> {
  const { slug } = await props.params;
  const clean = [...slug];
  const last = clean[clean.length - 1];
  if (!last?.endsWith(".png")) notFound();
  clean[clean.length - 1] = last.slice(0, -4);

  const page = source.getPage(clean[0] === "index" && clean.length === 1 ? [] : clean);
  if (!page) notFound();

  return new ImageResponse(
    OgCard({
      title: page.data.title,
      subtitle: page.data.description,
      canonical: HERO_DEFAULT_INPUT,
    }),
    { ...OG_SIZE, fonts: await loadOgFonts() },
  );
}
