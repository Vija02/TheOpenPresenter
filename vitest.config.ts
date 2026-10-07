import path from "node:path";
import { defineConfig } from "vitest/config";

const atAliasRoots = ["packages/ui/src", "apps/project/src"].map((dir) =>
  path.resolve(__dirname, dir),
);

export default defineConfig({
  plugins: [
    {
      name: "per-package-at-alias",
      enforce: "pre",
      resolveId(source, importer) {
        if (!source.startsWith("@/") || !importer) return null;
        const root = atAliasRoots.find((r) =>
          importer.startsWith(r + path.sep),
        );
        if (!root) return null;
        return this.resolve(path.join(root, source.slice(2)), importer, {
          skipSelf: true,
        });
      },
    },
  ],
  test: {
    fileParallelism: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    globals: true,
    environment: "jsdom",
    environmentMatchGlobs: [
      ["backend/**", "node"],
      ["**/*.node.test.ts", "node"],
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,playwright,tsup,build}.config.*",
      // Don't double test
      "**/loadedPlugins/**",
      "**/native-apps/**",
    ],
  },
});
