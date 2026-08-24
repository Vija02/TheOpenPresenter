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

  // Copy all these stuff because we need it for client plugin
  const runtimeResolved = [
    "@r2wc",
    "esbuild",
    "@tailwindcss/node",
    "@tailwindcss/oxide",
    "@tailwindcss/typography",
    "tailwindcss",
    "tw-animate-css",
  ];

  /**
   * The AI's find_lib_symbol / read_lib_types tools read the .d.ts of modules a
   * client plugin may import, so those need shipping
   */
  const sharedModulesSrc = fs.readFileSync(
    "./packages/shared-modules/dist/index.mjs",
    "utf-8",
  );
  const specifiers = [
    ...sharedModulesSrc.matchAll(/specifier:\s*["']([^"']+)["']/g),
  ].map((m) => m[1]);
  if (specifiers.length === 0) {
    throw new Error(
      "copy_deps: found no shared module specifiers; the parse is out of date",
    );
  }

  for (const specifier of specifiers) {
    const pkg = specifier.startsWith("@")
      ? specifier.split("/").slice(0, 2).join("/")
      : specifier.split("/")[0];
    // Copy repo types
    if (pkg.startsWith("@repo/")) continue;
    runtimeResolved.push(pkg);
    runtimeResolved.push(`@types/${pkg.replace(/^@/, "").replace("/", "__")}`);
  }

  /**
   * Copies a package plus its transitive deps
   */
  const copyWithDeps = (pkgName, seen, parentDir = null) => {
    const nested = parentDir
      ? path.join(parentDir, "node_modules", pkgName)
      : null;
    const from =
      nested && fs.existsSync(nested)
        ? nested
        : path.join(nodeModulesPath, pkgName);

    if (seen.has(from)) return;
    seen.add(from);
    // A package listing no types has no @types counterpart, which is normal.
    if (!fs.existsSync(from)) return;

    const relative = path.relative(nodeModulesPath, from);
    fs.cpSync(from, path.join(targetDir, nodeModulesPath, relative), {
      recursive: true,
      verbatimSymlinks: true,
    });

    const manifestPath = path.join(from, "package.json");
    if (!fs.existsSync(manifestPath)) return;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    // optionalDependencies carry the platform-specific native binaries
    // (esbuild's binary, oxide's .node), which are exactly what nft misses.
    for (const dep of [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
    ]) {
      copyWithDeps(dep, seen, from);
    }
  };

  const seen = new Set();
  for (const dep of [...new Set(runtimeResolved)]) {
    copyWithDeps(dep, seen);
  }

  // Copy over the yarn state
  fs.cpSync(
    path.join(nodeModulesPath, ".yarn-state.yml"),
    path.join(targetDir, nodeModulesPath, ".yarn-state.yml"),
  );

  // And ffmpeg since it's not detected
  fs.cpSync(
    path.join(nodeModulesPath, "ffmpeg-static"),
    path.join(targetDir, nodeModulesPath, "ffmpeg-static"),
    { recursive: true, verbatimSymlinks: true },
  );
};

run();
