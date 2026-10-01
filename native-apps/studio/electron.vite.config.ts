import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          onboarding: resolve(__dirname, "src/renderer/onboarding.html"),
          panel: resolve(__dirname, "src/renderer/panel.html"),
          loading: resolve(__dirname, "src/renderer/loading.html"),
          unreachable: resolve(__dirname, "src/renderer/unreachable.html"),
        },
      },
    },
  },
});
