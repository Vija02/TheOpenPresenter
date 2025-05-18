import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    globals: true,
    environment: 'jsdom',
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,playwright,tsup,build}.config.*",
      // Don't double test
      "**/loadedPlugins/**"
    ],
  },
});
