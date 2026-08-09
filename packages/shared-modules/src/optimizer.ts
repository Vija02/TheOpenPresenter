import { isSharedModule } from "./index";

// esbuild plugin that keeps shared modules out of Vite's dependency
// pre-bundling, so CJS deps cannot inline a second React. See README.md.

const PROXY_NAMESPACE = "shared-module-proxy";

export const externalizeSharedInOptimizer = () => ({
  name: "externalize-shared-modules",
  setup(build: {
    onResolve: (
      opts: { filter: RegExp; namespace?: string },
      cb: (args: { path: string; kind: string }) =>
        | { path: string; external?: boolean; namespace?: string }
        | null,
    ) => void;
    onLoad: (
      opts: { filter: RegExp; namespace?: string },
      cb: (args: { path: string }) => { contents: string; loader: "js" },
    ) => void;
  }) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === "entry-point") return null;
      if (!isSharedModule(args.path)) return null;

      // A require call cannot stay external; route it through an ESM proxy.
      if (args.kind === "require-call") {
        return { path: args.path, namespace: PROXY_NAMESPACE };
      }

      return { path: args.path, external: true };
    });

    // The proxy's own import must stay bare so the import map resolves it.
    build.onResolve({ filter: /.*/, namespace: PROXY_NAMESPACE }, (args) => ({
      path: args.path,
      external: true,
    }));

    build.onLoad({ filter: /.*/, namespace: PROXY_NAMESPACE }, (args) => ({
      contents: [
        `import * as shared from ${JSON.stringify(args.path)};`,
        `export * from ${JSON.stringify(args.path)};`,
        `export default shared.default ?? shared;`,
      ].join("\n"),
      loader: "js",
    }));
  },
});
