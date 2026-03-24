import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

import { dependencies, devDependencies } from "./package.json";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      exclude: ["**/*.test.ts", "**/*.test.tsx"],
      rollupTypes: true,
    }),
  ],
  build: {
    target: "esnext",
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        server: resolve(__dirname, "src/server/index.ts"),
        client: resolve(__dirname, "src/client/index.ts"),
      },
      formats: ["es", "cjs"],
      cssFileName: "client",
    },
    rollupOptions: {
      external: (id) => {
        // Externalize Node.js built-in modules
        if (
          builtinModules.includes(id) ||
          builtinModules.includes(id.replace("node:", ""))
        ) {
          return true;
        }
        // Externalize all dependencies including subpath imports
        const deps = [
          ...Object.keys(dependencies),
          ...Object.keys(devDependencies),
        ];
        if (id === "react/jsx-runtime") return true;
        return deps.some((dep) => id === dep || id.startsWith(dep + "/"));
      },
    },
  },
});
