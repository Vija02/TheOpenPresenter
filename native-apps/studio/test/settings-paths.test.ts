import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { chromiumDir, runtimeRoot, shellDir } from "../src/main/settings/paths";

/**
 * Settings live beside the runtime rather than in Electron's `userData`, so
 * one install is one folder. That only holds if this resolves the same root
 * the Rust manager does; `runtime-manager/src/storage/paths.rs` is the other
 * half of this contract.
 */

const ORIGINAL = process.env.TOP_RUNTIME_ROOT;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.TOP_RUNTIME_ROOT;
  else process.env.TOP_RUNTIME_ROOT = ORIGINAL;
});

describe("runtimeRoot", () => {
  it("prefers TOP_RUNTIME_ROOT, like the manager", () => {
    process.env.TOP_RUNTIME_ROOT = "/tmp/some-root";
    expect(runtimeRoot()).toBe("/tmp/some-root");
  });

  it("ignores an empty override rather than using an empty path", () => {
    process.env.TOP_RUNTIME_ROOT = "   ";
    expect(runtimeRoot().endsWith("TheOpenPresenter")).toBe(true);
  });

  /** The folder name has to match APP_DATA_FOLDER in paths.rs exactly. */
  it("falls back to the platform data directory", () => {
    delete process.env.TOP_RUNTIME_ROOT;
    expect(runtimeRoot().endsWith("TheOpenPresenter")).toBe(true);
  });

  /** Shell files get their own subfolder so they are never taken for a
      runtime version by prune. */
  it("keeps shell files in their own subfolder of the root", () => {
    process.env.TOP_RUNTIME_ROOT = "/tmp/some-root";
    expect(shellDir()).toBe(join("/tmp/some-root", "electron"));
  });

  /**
   * Chromium's own state gets a further subfolder: it creates a dozen
   * directories, and settings.json should not be lost among them.
   */
  it("keeps Chromium state below the shell folder", () => {
    process.env.TOP_RUNTIME_ROOT = "/tmp/some-root";
    expect(chromiumDir()).toBe(join("/tmp/some-root", "electron", "chromium"));
  });

  /**
   * The cookie jar has to move with the install it belongs to.
   *
   * Compared with `relative` rather than `startsWith`: on Windows `join`
   * normalises to backslashes while the raw env value keeps forward slashes,
   * so a string prefix check fails on a path that is genuinely inside.
   */
  it("puts Chromium state inside the runtime root", () => {
    process.env.TOP_RUNTIME_ROOT = "/tmp/some-root";
    const rel = relative(runtimeRoot(), chromiumDir());
    expect(rel.startsWith("..")).toBe(false);
    expect(rel).not.toBe("");
  });
});
