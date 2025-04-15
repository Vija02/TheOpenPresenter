import { promises as fs } from "fs";
import { join, resolve } from "path";

async function createSymlinks() {
  // Configure these paths
  const sourceDir = join("../../", "theopenpresenter");
  const targetDir = join("node-server", "theopenpresenter");
  const excludeFolder = "tauri";

  try {
    // Make sure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    // Read source directory
    const files = await fs.readdir(sourceDir, { withFileTypes: true });

    for (const file of files) {
      if (file.name !== excludeFolder) {
        const sourcePath = resolve(sourceDir, file.name);
        const targetPath = resolve(targetDir, file.name);

        // Create symlink with appropriate type
        const symlinkType = file.isDirectory() ? "junction" : "file";

        try {
          await fs.symlink(sourcePath, targetPath, symlinkType);
          console.log(`Created symlink for ${file.name}`);
        } catch (err) {
          if (err.code !== "EEXIST") {
            console.error(`Error creating symlink for ${file.name}:`, err);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

createSymlinks();
