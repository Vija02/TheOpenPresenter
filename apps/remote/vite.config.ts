import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import postcssNested from "postcss-nested";
import { defineConfig } from "vite";
import externalize from "vite-plugin-externalize-dependencies";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    externalize({
      externals: ["yjs"],
    }),
  ],
  css: { postcss: { plugins: [postcssNested() as any] } },
  base: "/app",
  build: {
    sourcemap: false,
    rollupOptions: {
      external: ["yjs", "react", "react-dom", "react-dom/client"],
    },
  },
});
