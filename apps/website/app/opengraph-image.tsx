import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard } from "@/lib/og-template";
import { loadOgFonts } from "@/lib/og-fonts";
import { HERO_DEFAULT_INPUT } from "@/lib/demo-schema";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt =
  "querypipe — one typed query contract from URL to database. A colorized canonical query string.";

export default async function OpengraphImage() {
  return new ImageResponse(
    OgCard({
      title: "One typed contract from URL to database.",
      subtitle: "Filtering · progressive multi-sort · pagination · backend-safe · never throws",
      canonical: HERO_DEFAULT_INPUT,
    }),
    { ...size, fonts: await loadOgFonts() },
  );
}
