import react from "@vitejs/plugin-react-swc";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

import { dependencies, devDependencies } from "./package.json";

export default defineConfig({
  plugins: [
    react(),
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
    },
    rollupOptions: {
      external: (id) => {
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
