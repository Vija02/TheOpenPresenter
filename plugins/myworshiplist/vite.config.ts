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
      entry: "./view/main.tsx",
      name: "myworshiplist-remote",
      fileName: (format) => `myworshiplist-remote.${format}.js`,
    },
    rollupOptions: {
      external: ["yjs"],
    },
    target: "esnext",
  },
});
