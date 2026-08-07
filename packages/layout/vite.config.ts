import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

import {
  dependencies,
  devDependencies,
  peerDependencies,
} from "./package.json";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    dts({
      exclude: ["**/*.test.ts", "**/*.test.tsx"],
    }),
  ],
  build: {
    target: "esnext",
    // Per-entry CSS instead of one merged file, so importing the renderer
    // never drags in the editor chrome (and the Tailwind layer it needs).
    // Lib mode defaults this to false, which would emit a single stylesheet.
    cssCodeSplit: true,
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        react: resolve(__dirname, "src/react/index.ts"),
        editor: resolve(__dirname, "src/editor/index.ts"),
        ai: resolve(__dirname, "src/ai/index.ts"),
      },
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] ?? assetInfo.name ?? "";
          return name.endsWith(".css")
            ? "[name].[ext]"
            : "assets/[name]-[hash][extname]";
        },
      },
      external: (id) => {
        if (
          builtinModules.includes(id) ||
          builtinModules.includes(id.replace("node:", ""))
        ) {
          return true;
        }
        const deps = [
          ...Object.keys(dependencies),
          ...Object.keys(devDependencies),
          ...Object.keys(peerDependencies),
        ];
        if (id === "react/jsx-runtime") return true;
        return deps.some((dep) => id === dep || id.startsWith(dep + "/"));
      },
    },
  },
});
