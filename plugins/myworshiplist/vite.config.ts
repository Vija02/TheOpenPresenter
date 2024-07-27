import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    "process.env": {
      NODE_ENV: "production",
    },
  },
  plugins: [react()],
  build: {
    lib: {
      entry: ["./view/remote.tsx", "./view/renderer.tsx"],
      name: "myworshiplist-views",
      fileName: (format, entryName) =>
        `myworshiplist-${entryName}.${format}.js`,
    },
    rollupOptions: {
      external: ["yjs"],
    },
    target: "esnext",
  },
});
