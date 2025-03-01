const { nodeFileTrace } = require("@vercel/nft");
const fs = require("fs");
const path = require("path");

const workerTasks = fs.readdirSync("./backend/worker/dist/tasks");

const files = [
  "./backend/server/dist/index.js",
  ...workerTasks.map((x) => path.join("./backend/worker/dist/tasks", x)),
  "./node_modules/graphile-worker/dist/cli.js"
];

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
