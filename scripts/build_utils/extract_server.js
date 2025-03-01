const { nodeFileTrace } = require("@vercel/nft");
const fs = require("fs");

const files = ["./backend/server/dist/index.js"];

(async () => {
  try {
    const { fileList } = await nodeFileTrace(files, {
      ignore: (prop) =>
        !prop.startsWith("node_modules") || prop.includes("/@repo/"),
    });

    fs.mkdirSync("./nft_results", { recursive: true });
    fs.writeFileSync(
      "./nft_results/server.json",
      JSON.stringify(Array.from(fileList)),
    );
  } catch (e) {
    console.error(e);
  }
})();
