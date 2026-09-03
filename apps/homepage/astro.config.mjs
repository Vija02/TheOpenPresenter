import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import rehypeImageFigures from "./src/plugins/rehype-image-figures.mjs";

// https://astro.build/config
export default defineConfig({
  site: "https://theopenpresenter.com",
  integrations: [sitemap()],
  markdown: {
    rehypePlugins: [rehypeImageFigures],
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      assetsInlineLimit: 0,
    },
  },
  trailingSlash: "never",
});
