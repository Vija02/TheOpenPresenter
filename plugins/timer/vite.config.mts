import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import autoprefixer from "autoprefixer";
import prefixer from "postcss-prefix-selector";
import { defineConfig } from "vite";

import { pluginName } from "./src/consts";

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    "process.env": {
      NODE_ENV: "production",
    },
  },
  plugins: [react(), tailwindcss()],
  css: {
    postcss: {
      plugins: [
        prefixer({
          prefix: `#pl-${pluginName}`,
        }) as any,
        autoprefixer({}),
      ],
    },
  },
  build: {
    outDir: "out",
    lib: {
      entry: ["./view/entries/remote.tsx", "./view/entries/renderer.tsx"],
      name: `${pluginName}-views`,
      fileName: (format, entryName) =>
        `${pluginName}-${entryName}.${format}.js`,
    },
    cssCodeSplit: true,
    rollupOptions: {
      external: ["yjs", "react", "react-dom", "react-dom/client"],
    },
    target: "esnext",
  },
});
