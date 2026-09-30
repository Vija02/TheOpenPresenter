import { copyFileSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "tsup";

export default defineConfig({
  shims: true,
  async onSuccess() {
    copyFileSync(
      resolve("src/electronArgvShim.cjs"),
      resolve("dist/electronArgvShim.cjs"),
    );
  },
});
