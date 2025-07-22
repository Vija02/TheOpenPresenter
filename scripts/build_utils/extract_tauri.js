const { nodeFileTrace } = require("@vercel/nft");
const fs = require("fs");

const files = ["./packages/embedded-postgres/dist/index.js"];

// Just copy these straight up for tauri
const staticFileList = [
  "node_modules/embedded-postgres",
  "node_modules/@embedded-postgres",
];

(async () => {
  try {
    const { fileList } = await nodeFileTrace(files, {
      ignore: (prop) =>
        !prop.startsWith("node_modules") || prop.includes("/@repo/"),
    });

    fs.mkdirSync("./nft_results", { recursive: true });
    fs.writeFileSync(
      "./nft_results/tauri.json",
      JSON.stringify(staticFileList.concat(Array.from(fileList))),
    );
  } catch (e) {
    console.error(e);
  }
})();
