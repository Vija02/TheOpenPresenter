import { platformArchTriples } from "@napi-rs/triples";
import { createWriteStream, existsSync, mkdtempSync } from "fs";
import { copyFile } from "fs/promises";
import fetch from "node-fetch";
import { tmpdir } from "os";
import { join } from "path";
import { pipeline } from "stream/promises";
import { extract } from "tar";

// Current LTS
const NODE_VERSION = "v22.14.0";

const downloadWindowsBinary = async () => {
  const platform = process.platform;
  const arch = process.arch;

  const supportedArch = ["x64", "x86", "arm64"];

  if (!supportedArch.includes(arch)) {
    throw new Error(`Unsupported arch "${arch}" for platform "${platform}"`);
  }

  const link = `https://nodejs.org/download/release/${NODE_VERSION}/win-${arch}/node.exe`;

  const nodeFileName = `node-${platformArchTriples[platform][arch].find((x) => x.abi === "msvc").raw}.exe`;

  await downloadFile(link, nodeFileName);

  return nodeFileName;
};

const downloadLinuxBinary = async () => {
  const platform = process.platform;
  const arch = process.arch;

  const supportedArch = ["x64", "arm64", "armv7l", "ppc64le", "s390x"];

  if (!supportedArch.includes(arch)) {
    throw new Error(`Unsupported arch "${arch}" for platform "${platform}"`);
  }

  const nodeDownloadedName = `node-${NODE_VERSION}-linux-${arch}`;
  const link = `https://nodejs.org/download/release/${NODE_VERSION}/${nodeDownloadedName}.tar.gz`;

  const nodeFileName = `node-${platformArchTriples[platform][arch].find((x) => x.abi === "gnu").raw}`;

  await downloadFile(link, "downloaded.tar.gz");

  // Extract tar
  await extract({
    file: "downloaded.tar.gz",
  });

  await copyFile(join(nodeDownloadedName, "bin", "node"), nodeFileName);

  return nodeFileName;
};

const downloadDarwinBinary = async () => {
  const platform = process.platform;
  const arch = process.arch;

  const supportedArch = ["x64", "arm64"];

  if (!supportedArch.includes(arch)) {
    throw new Error(`Unsupported arch "${arch}" for platform "${platform}"`);
  }

  const nodeDownloadedName = `node-${NODE_VERSION}-darwin-${arch}`;
  const link = `https://nodejs.org/download/release/${NODE_VERSION}/${nodeDownloadedName}.tar.gz`;

  const nodeFileName = `node-${platformArchTriples[platform][arch][0].raw}`;

  await downloadFile(link, "downloaded.tar.gz");

  // Extract tar
  await extract({
    file: "downloaded.tar.gz",
  });

  await copyFile(join(nodeDownloadedName, "bin", "node"), nodeFileName);

  return nodeFileName;
};

async function downloadNodejs() {
  const platform = process.platform;
  const arch = process.arch;

  try {
    // Original path
    const originalPath = process.cwd();

    // Simple check - if node binary already exists, skip download
    if (existsSync(join(originalPath, "node")) || existsSync(join(originalPath, "node.exe"))) {
      console.log("Node binary already exists, skipping download");
      return;
    }

    // Create temp directory
    const tempDir = mkdtempSync(join(tmpdir(), "node-temp"));
    process.chdir(tempDir);

    let nodeFileName;

    if (platform === "win32") {
      nodeFileName = await downloadWindowsBinary();
      await copyFile(
        join(tempDir, nodeFileName),
        join(originalPath, nodeFileName),
      );
      if (!existsSync(join(originalPath, "node.exe"))) {
        await copyFile(
          join(tempDir, nodeFileName),
          join(originalPath, "node.exe"),
        );
      }
    } else if (platform === "linux") {
      nodeFileName = await downloadLinuxBinary();
      await copyFile(
        join(tempDir, nodeFileName),
        join(originalPath, nodeFileName),
      );
      await copyFile(join(tempDir, nodeFileName), join(originalPath, "node"));
    } else if (platform === "darwin") {
      nodeFileName = await downloadDarwinBinary();
      await copyFile(
        join(tempDir, nodeFileName),
        join(originalPath, nodeFileName),
      );
      await copyFile(join(tempDir, nodeFileName), join(originalPath, "node"));
    } else {
      throw new Error(`Unsupported arch "${arch}" for platform "${platform}"`);
    }

    console.log("Node binary downloaded successfully");
  } catch (error) {
    console.error("Failed to download node binary:", error);
    process.exit(1);
  }
}

async function downloadFile(url, filename) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}`);
  await pipeline(response.body, createWriteStream(filename));
}

// Run the installation
downloadNodejs();
