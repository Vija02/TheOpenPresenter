/// <reference types="vitest/config" />
import { isSharedModule } from "@repo/shared-modules";
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
      external: (id: string) => {
        if (id === "react/jsx-runtime") return true;
        if (isSharedModule(id)) return true;
        return Object.keys(peerDependencies).some(
          (dep) => id === dep || id.startsWith(dep + "/"),
        );
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
