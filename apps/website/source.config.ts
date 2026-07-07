import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { querypipeShikiThemes } from "./lib/shiki-theme";

export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        light: querypipeShikiThemes.light as never,
        dark: querypipeShikiThemes.dark as never,
      },
    },
  },
});
