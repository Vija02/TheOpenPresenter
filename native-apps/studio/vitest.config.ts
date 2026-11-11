import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
  },
  resolve: {
    alias: {
      electron: resolve(__dirname, "test/stubs/electron.ts"),
    },
  },
});
