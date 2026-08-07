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
  plugins: [
    react(),
    tailwindcss(),
    dts({
      exclude: ["**/*.test.ts", "**/*.test.tsx"],
    }),
  ],
  build: {
    target: "esnext",
    lib: {
      entry: { index: resolve(__dirname, "src/index.ts") },
      formats: ["es", "cjs"],
      cssFileName: "index",
    },
    rollupOptions: {
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
