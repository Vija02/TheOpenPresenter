import { beforeEach, describe, expect, it, vi } from "vitest";

const openExternal = vi.fn(() => Promise.resolve());

vi.mock("electron", () => ({ shell: { openExternal } }));

const { openExternalSafely } = await import("../src/main/shell/external");

describe("openExternalSafely", () => {
  beforeEach(() => {
    openExternal.mockClear();
  });

  it("opens ordinary web links", async () => {
    expect(await openExternalSafely("https://theopenpresenter.com")).toBe(true);
    expect(await openExternalSafely("http://localhost:5678/o")).toBe(true);
    expect(await openExternalSafely("mailto:hello@example.com")).toBe(true);
    expect(openExternal).toHaveBeenCalledTimes(3);
  });

  /**
   * The IPC channel behind this is reachable from whatever page is loaded, so
   * these are the URLs a hostile page would try: each either reads a local
   * file or hands the OS something it will happily launch.
   */
  it("refuses schemes that reach the operating system", async () => {
    const dangerous = [
      "file:///etc/passwd",
      "file://C:/Windows/System32/config/SAM",
      "smb://attacker.example.com/share",
      "ms-msdt:/id PCWDiagnostic",
      "search-ms:query=secret",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
    ];

    for (const url of dangerous) {
      expect(await openExternalSafely(url), `${url} must be refused`).toBe(
        false,
      );
    }
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("refuses anything that is not a URL", async () => {
    expect(await openExternalSafely("")).toBe(false);
    expect(await openExternalSafely("not a url")).toBe(false);
    expect(await openExternalSafely("/etc/passwd")).toBe(false);
    expect(openExternal).not.toHaveBeenCalled();
  });
});
