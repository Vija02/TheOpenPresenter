/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { join, resolve } from "node:path";
import utwm from "unplugin-tailwindcss-mangle/vite";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

import { peerDependencies } from "./package.json";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts(),
    // Mangle the classname to avoid clashes
    utwm({ classGenerator: { classPrefix: "u-" } }),
  ],
  build: {
    target: "esnext",
    minify: true,
    lib: {
      entry: resolve(__dirname, join("src", "index.ts")),
      fileName: "index",
      cssFileName: "style",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // Exclude peer dependencies from the bundle to reduce bundle size
      external: [
        "react/jsx-runtime",
        ...Object.keys(peerDependencies),
        "@repo/base-plugin/client",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
