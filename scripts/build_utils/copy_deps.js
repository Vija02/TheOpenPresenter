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
    fs.cpSync(filePath, targetPath, {
      recursive: true,
      verbatimSymlinks: true,
    });
  }

  // Copy some files manually
  const nodeModulesPath = "./node_modules";

  // Copy over the yarn state
  fs.cpSync(
    path.join(nodeModulesPath, ".yarn-state.yml"),
    path.join(targetDir, nodeModulesPath, ".yarn-state.yml"),
  );
  // And also the @repo symlink
  // fs.cpSync(
  //   path.join(nodeModulesPath, "@repo"),
  //   path.join(targetDir, nodeModulesPath, "@repo"),
  //   { recursive: true, verbatimSymlinks: true },
  // );
  // And last but not least, get next specifically due to its complicated require setup. We'll get problems otherwise
  fs.cpSync(
    path.join(nodeModulesPath, "next"),
    path.join(targetDir, nodeModulesPath, "next"),
    { recursive: true },
  );
  fs.cpSync(
    path.join(nodeModulesPath, "graphile-migrate"),
    path.join(targetDir, nodeModulesPath, "graphile-migrate"),
    { recursive: true },
  );
  fs.cpSync(
    path.join(nodeModulesPath, "ffmpeg-static"),
    path.join(targetDir, nodeModulesPath, "ffmpeg-static"),
    { recursive: true },
  );
};

run();
