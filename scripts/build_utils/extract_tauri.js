const { nodeFileTrace } = require("@vercel/nft");
const fs = require("fs");

const files = ["./packages/embedded-postgres/dist/index.js"];

(async () => {
  try {
    const { fileList } = await nodeFileTrace(files, {
      ignore: (prop) =>
        !prop.startsWith("node_modules") || prop.includes("/@repo/"),
    });

    fs.mkdirSync("./nft_results", { recursive: true });
    fs.writeFileSync(
      "./nft_results/tauri.json",
      JSON.stringify(Array.from(fileList)),
    );
  } catch (e) {
    console.error(e);
  }
})();
