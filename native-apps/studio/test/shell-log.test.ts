import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logShell, shellLogPath } from "../src/main/shell/log";

/**
 * A failed update check used to leave no trace: electron-updater logs through a
 * no-op logger out of the box, and a packaged app has no console to print to.
 * The file these write to is the same folder the diagnostics report collects.
 */
describe("shell log", () => {
  const previousRoot = process.env.TOP_RUNTIME_ROOT;
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "top-shell-log-"));
    process.env.TOP_RUNTIME_ROOT = root;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousRoot === undefined) delete process.env.TOP_RUNTIME_ROOT;
    else process.env.TOP_RUNTIME_ROOT = previousRoot;
  });

  it("writes beside the runtime log, with the error detail", () => {
    logShell(
      "error",
      "[updates]",
      new Error("404 on TheOpenPresenter-Setup-1.0.1.exe"),
    );

    const path = shellLogPath();
    expect(path).toBe(join(root, "logs", "electron.log"));

    const content = readFileSync(path, "utf8");
    expect(content).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z ERROR /);
    expect(content).toContain("[updates]");
    expect(content).toContain("404 on TheOpenPresenter-Setup-1.0.1.exe");
  });

  it("does not throw when the log directory cannot be created", () => {
    // A file where the `logs` directory belongs.
    writeFileSync(join(root, "logs"), "");

    expect(() => logShell("error", "boom")).not.toThrow();
  });
});
