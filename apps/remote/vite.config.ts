import { sharedExternals } from "@repo/shared-modules";
import { externalizeSharedInOptimizer } from "@repo/shared-modules/optimizer";
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
      externals: [sharedExternals],
    }),
  ],
  optimizeDeps: {
    esbuildOptions: {
      plugins: [externalizeSharedInOptimizer()],
    },
  },
  css: { postcss: { plugins: [postcssNested() as any] } },
  base: "/app",
  build: {
    sourcemap: false,
    rollupOptions: {
      external: sharedExternals,
    },
  },
});
