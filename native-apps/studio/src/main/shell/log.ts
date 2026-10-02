import { appendFileSync, mkdirSync, statSync, writeFileSync } from "fs";
import { join } from "path";

import { runtimeRoot } from "../settings/paths";

/**
 * The shell's own log file.
 */

const MAX_BYTES = 256 * 1024;

type Level = "debug" | "info" | "warn" | "error";

export function shellLogPath(): string {
  return join(runtimeRoot(), "logs", "electron.log");
}

/** Append one line to the shell log */
export function logShell(level: Level, ...parts: unknown[]): void {
  if (level === "error") console.error(...parts);
  else if (level === "warn") console.warn(...parts);
  else console.log(...parts);

  const message = parts
    .map((part) =>
      part instanceof Error ? (part.stack ?? part.message) : String(part),
    )
    .join(" ");

  try {
    const dir = join(runtimeRoot(), "logs");
    mkdirSync(dir, { recursive: true });

    const path = shellLogPath();
    try {
      // Truncated rather than rotated: the recent end is the useful end, and
      // this file is shipped whole inside a diagnostics report.
      if (statSync(path).size > MAX_BYTES) writeFileSync(path, "");
    } catch {
      // No file yet; the append below creates it.
    }

    appendFileSync(
      path,
      `${new Date().toISOString()} ${level.toUpperCase()} ${message}\n`,
      "utf8",
    );
  } catch {
    // An unwritable log must not take the app down with it.
  }
}

export const shellLogger = {
  info: (...parts: unknown[]) => logShell("info", ...parts),
  warn: (...parts: unknown[]) => logShell("warn", ...parts),
  error: (...parts: unknown[]) => logShell("error", ...parts),
  debug: (...parts: unknown[]) => logShell("debug", ...parts),
};
