import { createHash } from "crypto";
import { mkdtempSync } from "fs";
import { createWriteStream } from "fs";
import { copyFileSync, readFileSync } from "fs";
import fetch from "node-fetch";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { pipeline } from "stream/promises";
import { extract } from "tar";

// Debt: We need to change this manually when we upgrade our PG version
const PG_VERSION = "17";

async function installPgUuidv7() {
  try {
    // Original path
    const originalPath = process.cwd();

    // Create temp directory
    const tempDir = mkdtempSync(join(tmpdir(), "pg_uuidv7-"));
    process.chdir(tempDir);

    // Download files
    const baseUrl =
      "https://github.com/fboulnois/pg_uuidv7/releases/download/v1.6.0";
    await Promise.all([
      downloadFile(`${baseUrl}/pg_uuidv7.tar.gz`, "pg_uuidv7.tar.gz"),
      downloadFile(`${baseUrl}/SHA256SUMS`, "SHA256SUMS"),
    ]);

    // Extract tar
    await extract({
      file: "pg_uuidv7.tar.gz",
    });

    // Verify checksum
    verifyChecksum("SHA256SUMS");

    // Get Rust-style format platform & arch
    const platform = process.platform;
    const arch = process.arch;
    const rustStyleTarget = `${platform === "win32" ? "windows" : platform}-${arch}`;

    const extensionDir = resolve(
      originalPath,
      `node-server/node_modules/@embedded-postgres/${rustStyleTarget}/native/share/postgresql/extension/`,
    );
    const libDir = resolve(
      originalPath,
      `node-server/node_modules/@embedded-postgres/${rustStyleTarget}/native/lib/postgresql/`,
    );

    // Copy files
    copyFileSync(
      join(tempDir, PG_VERSION, "pg_uuidv7.so"),
      join(libDir, "pg_uuidv7.so"),
    );

    copyFileSync(
      join(tempDir, "pg_uuidv7--1.6.sql"),
      join(extensionDir, "pg_uuidv7--1.6.sql"),
    );

    copyFileSync(
      join(tempDir, "pg_uuidv7.control"),
      join(extensionDir, "pg_uuidv7.control"),
    );

    console.log("PG extension installation completed successfully");
  } catch (error) {
    console.error("PG extension installation failed:", error);
    process.exit(1);
  }
}

async function downloadFile(url, filename) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}`);
  await pipeline(response.body, createWriteStream(filename));
}

function verifyChecksum(checksumFile) {
  const checksums = readFileSync(checksumFile, "utf8");
  const lines = checksums.split("\n").filter((line) => line);

  for (const line of lines) {
    const [expectedHash, filename] = line.split("  ");
    const fileBuffer = readFileSync(filename);
    const actualHash = createHash("sha256").update(fileBuffer).digest("hex");

    if (actualHash !== expectedHash) {
      throw new Error(`Checksum verification failed for ${filename}`);
    }
  }
}

// Run the installation
installPgUuidv7();
