const fs = require("fs");
const path = require("path");

const run = () => {
  const targetDir = "./node_modules_nft";

  const files = fs.readdirSync("./nft_results");

  let filesToCopy = [];

  for (const file of files) {
    if (!file.endsWith("json")) {
      continue;
    }

    const data = JSON.parse(
      fs.readFileSync(path.join("./nft_results", file), "utf-8"),
    );
    filesToCopy.push(...data);
  }

  const uniqueFilesToCopy = Array.from(new Set(filesToCopy)).filter((x) =>
    x.startsWith("node_modules"),
  );

  for (const filePath of uniqueFilesToCopy) {
    const targetPath = path.join(targetDir, filePath);

    // Create necessary directories
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    // Copy the file
    fs.copyFileSync(filePath, targetPath);
  }
};

run();
