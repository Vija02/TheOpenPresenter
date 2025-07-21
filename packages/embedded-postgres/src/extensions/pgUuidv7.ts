import { createHash } from "crypto";
import { mkdtempSync, createWriteStream, copyFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import fetch from "node-fetch";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { pipeline } from "stream/promises";
import { extract } from "tar";
import { getEmbeddedPostgresPaths } from "../utils/paths.js";
import type { ExtensionFile } from "../types/index.js";

// Debt: We need to change this manually when we upgrade our PG version
const PG_VERSION = "17";

export class PgUuidv7Extension {
  private projectRoot: string;
  private extensionSourcePath?: string;

  constructor(projectRoot: string, extensionSourcePath?: string) {
    this.projectRoot = projectRoot;
    this.extensionSourcePath = extensionSourcePath;
  }

  async install(): Promise<void> {
    try {
      console.log("Installing pg_uuidv7 extension...");
      
      const { extensionDir, libDir } = getEmbeddedPostgresPaths(this.projectRoot);
      
      // Ensure directories exist
      mkdirSync(extensionDir, { recursive: true });
      mkdirSync(libDir, { recursive: true });
      
      // Check if we have pre-built extension files
      if (this.extensionSourcePath && this.hasPrebuiltExtension()) {
        await this.installPrebuiltExtension(extensionDir, libDir);
      } else {
        await this.downloadAndInstallExtension(extensionDir, libDir);
      }
      
      console.log("PG extension installation completed successfully");
    } catch (error) {
      console.error("PG extension installation failed:", error);
      throw error;
    }
  }

  private hasPrebuiltExtension(): boolean {
    if (!this.extensionSourcePath) return false;
    
    const dllPath = join(this.extensionSourcePath, "pg_uuidv7.dll");
    return existsSync(dllPath);
  }

  private async installPrebuiltExtension(extensionDir: string, libDir: string): Promise<void> {
    if (!this.extensionSourcePath) {
      throw new Error("Extension source path not provided");
    }

    console.log("Using pre-built extension files...");
    
    // Copy the pre-built DLL for Windows
    if (process.platform === "win32") {
      const sourceDll = join(this.extensionSourcePath, "pg_uuidv7.dll");
      const targetDll = join(libDir, "pg_uuidv7.dll");
      copyFileSync(sourceDll, targetDll);
      console.log(`Copied pre-built DLL: ${sourceDll} -> ${targetDll}`);
    }

    // For SQL and control files, we still need to download them
    await this.downloadSqlAndControlFiles(extensionDir);
  }

  private async downloadAndInstallExtension(extensionDir: string, libDir: string): Promise<void> {
    const originalPath = process.cwd();
    const tempDir = mkdtempSync(join(tmpdir(), "pg_uuidv7-"));
    
    try {
      process.chdir(tempDir);

      // Download files
      const baseUrl = "https://github.com/fboulnois/pg_uuidv7/releases/download/v1.6.0";
      await Promise.all([
        this.downloadFile(`${baseUrl}/pg_uuidv7.tar.gz`, "pg_uuidv7.tar.gz"),
        this.downloadFile(`${baseUrl}/SHA256SUMS`, "SHA256SUMS"),
      ]);

      // Extract tar
      await extract({
        file: "pg_uuidv7.tar.gz",
      });

      // Verify checksum
      this.verifyChecksum("SHA256SUMS");

      // Copy files
      if (process.platform === "win32") {
        // For Windows, use pre-built DLL if available, otherwise error
        if (this.extensionSourcePath) {
          const sourceDll = join(this.extensionSourcePath, "pg_uuidv7.dll");
          const targetDll = join(libDir, "pg_uuidv7.dll");
          copyFileSync(sourceDll, targetDll);
        } else {
          throw new Error("Windows DLL not found. Please provide extensionSourcePath with pg_uuidv7.dll");
        }
      } else {
        // For Unix systems, use the downloaded .so file
        copyFileSync(
          join(tempDir, PG_VERSION, "pg_uuidv7.so"),
          join(libDir, "pg_uuidv7.so")
        );
      }

      // Copy SQL and control files
      copyFileSync(
        join(tempDir, "pg_uuidv7--1.6.sql"),
        join(extensionDir, "pg_uuidv7--1.6.sql")
      );

      copyFileSync(
        join(tempDir, "pg_uuidv7.control"),
        join(extensionDir, "pg_uuidv7.control")
      );
    } finally {
      process.chdir(originalPath);
    }
  }

  private async downloadSqlAndControlFiles(extensionDir: string): Promise<void> {
    const originalPath = process.cwd();
    const tempDir = mkdtempSync(join(tmpdir(), "pg_uuidv7-sql-"));
    
    try {
      process.chdir(tempDir);

      // Download and extract just for SQL files
      const baseUrl = "https://github.com/fboulnois/pg_uuidv7/releases/download/v1.6.0";
      await this.downloadFile(`${baseUrl}/pg_uuidv7.tar.gz`, "pg_uuidv7.tar.gz");
      
      await extract({
        file: "pg_uuidv7.tar.gz",
      });

      // Copy SQL and control files
      copyFileSync(
        join(tempDir, "pg_uuidv7--1.6.sql"),
        join(extensionDir, "pg_uuidv7--1.6.sql")
      );

      copyFileSync(
        join(tempDir, "pg_uuidv7.control"),
        join(extensionDir, "pg_uuidv7.control")
      );
    } finally {
      process.chdir(originalPath);
    }
  }

  private async downloadFile(url: string, filename: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download ${url}`);
    if (!response.body) throw new Error(`No response body for ${url}`);
    await pipeline(response.body, createWriteStream(filename));
  }

  private verifyChecksum(checksumFile: string): void {
    const checksums = readFileSync(checksumFile, "utf8");
    const lines = checksums.split("\n").filter((line) => line);

    for (const line of lines) {
      const [expectedHash, filename] = line.split("  ");
      if (!filename || !existsSync(filename)) continue;
      
      const fileBuffer = readFileSync(filename);
      const actualHash = createHash("sha256").update(fileBuffer).digest("hex");

      if (actualHash !== expectedHash) {
        throw new Error(`Checksum verification failed for ${filename}`);
      }
    }
  }
}