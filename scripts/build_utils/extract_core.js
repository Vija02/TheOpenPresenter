const { nodeFileTrace } = require("@vercel/nft");
const fs = require("fs");

const files = [
  "./packages/graphql/dist/index.js",
  "./backend/config/dist/index.js",
  "./backend/config/env.js",
  "./packages/lib/dist/index.js",
  "./packages/portable-file/dist/index.js",
  "./packages/observability/dist/index.js",
  "./packages/observability/initTracing.js",
  "./backend/backend-shared/dist/index.js",
  "./packages/base-plugin/dist/index.js",
  "./packages/base-plugin/dist/server/index.js",
];

(async () => {
  try {
    const { fileList } = await nodeFileTrace(files, {
      ignore: (prop) =>
        !prop.startsWith("node_modules") || prop.includes("/@repo/"),
    });

    fs.mkdirSync("./nft_results", { recursive: true });
    fs.writeFileSync(
      "./nft_results/core.json",
      JSON.stringify(Array.from(fileList)),
    );
  } catch (e) {
    console.error(e);
  }
})();
