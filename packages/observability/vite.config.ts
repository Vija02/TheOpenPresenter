import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    "process.env": {
      NODE_ENV: "production",
    },
  },
  plugins: [dts({ include: ["./src/initBrowser.ts", "./src/types.d.ts"] })],
  build: {
    outDir: "out",
    lib: {
      // Annoyingly, pkgroll can't really bundle OTEL well
      // So for now, we use vite to bundle it
      // This is a hack until maybe when pkgroll allows plugin extension
      entry: ["./src/initBrowser.ts"],
      name: `initBrowser`,
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    target: "esnext",
  },
});
