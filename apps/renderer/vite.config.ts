import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
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
  base: "/render",
  build: {
    sourcemap: false,
    rollupOptions: {
      external: ["yjs", "react", "react-dom", "react-dom/client"],
    },
  },
});
