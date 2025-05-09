import node from "@astrojs/node";
import { defineConfig } from "astro/config";

export default defineConfig({
  adapter: node({
    mode: "middleware",
  }),
  output: "server"
});
