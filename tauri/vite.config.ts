import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  publicDir: "./frontend/public",
  build: {
    outDir: "frontendDist",
    lib: {
      entry: ["./frontend/index.html", "./frontend/splashscreen.html"],
    },
  },
});
