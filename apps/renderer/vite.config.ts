import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import externalize from "vite-plugin-externalize-dependencies";

import { sharedExternals } from "@repo/shared-modules";
import { externalizeSharedInOptimizer } from "@repo/shared-modules/optimizer";

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
  base: "/render",
  build: {
    sourcemap: false,
    rollupOptions: {
      external: sharedExternals,
    },
  },
});
