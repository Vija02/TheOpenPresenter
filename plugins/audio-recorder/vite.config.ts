import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

import { pluginName } from "./src/consts";

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    "process.env": {
      NODE_ENV: "production",
    },
  },
  plugins: [react()],
  build: {
    outDir: "out",
    lib: {
      entry: ["./view/remote.tsx", "./view/renderer.tsx"],
      name: `${pluginName}-views`,
      fileName: (format, entryName) =>
        `${pluginName}-${entryName}.${format}.js`,
    },
    rollupOptions: {
      external: ["yjs"],
    },
    target: "esnext",
  },
});
