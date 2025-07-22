const fs = require("fs");

// Just copy these straight up for tauri
const fileList = [
  "node_modules/embedded-postgres",
  "node_modules/@embedded-postgres",
];

(async () => {
  try {
    fs.mkdirSync("./nft_results", { recursive: true });
    fs.writeFileSync(
      "./nft_results/tauri.json",
      JSON.stringify(Array.from(fileList)),
    );
  } catch (e) {
    console.error(e);
  }
})();
