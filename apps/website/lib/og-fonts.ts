import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * OG-image fonts, read from disk. Both OG routes are force-static, so this
 * only ever runs at build time where cwd is apps/website and the files exist.
 */
export async function loadOgFonts() {
  const dir = path.join(process.cwd(), "assets", "fonts");
  const [regular, semibold] = await Promise.all([
    readFile(path.join(dir, "IBMPlexMono-Regular.ttf")),
    readFile(path.join(dir, "IBMPlexMono-SemiBold.ttf")),
  ]);
  return [
    { name: "IBM Plex Mono", data: regular, weight: 400 as const },
    { name: "IBM Plex Mono", data: semibold, weight: 600 as const },
  ];
}
