const { nodeFileTrace } = require("@vercel/nft");
const fs = require("fs");
const path = require("path");

const plugins = fs.readdirSync("./plugins");

const files = plugins.map((x) => path.join("./plugins", x, "dist/index.js"));

(async () => {
  try {
    const { fileList } = await nodeFileTrace(files, {
      ignore: (prop) =>
        !prop.startsWith("node_modules") || prop.includes("/@repo/"),
    });

    fs.mkdirSync("./nft_results", { recursive: true });
    fs.writeFileSync(
      "./nft_results/plugins.json",
      JSON.stringify(Array.from(fileList)),
    );
  } catch (e) {
    console.error(e);
  }
})();
