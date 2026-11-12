import { resolve } from "path";
import { pathToFileURL } from "url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const settings = { rootUrl: undefined as string | undefined };
const runtimeRef = { url: null as string | null };
const stored: Record<string, unknown> = {};

vi.mock("electron", () => ({ shell: { openExternal: vi.fn() } }));
vi.mock("../src/main/settings/store", () => ({
  getSettings: () => settings,
  store: { get: (key: string) => stored[key] ?? null },
}));
vi.mock("../src/main/runtime/client", () => ({
  runtime: runtimeRef,
}));

const { isAllowedAppUrl, isShellPage } = await import(
  "../src/main/shell/origins"
);

describe("isAllowedAppUrl", () => {
  beforeEach(() => {
    runtimeRef.url = "http://localhost:45295";
    settings.rootUrl = "https://theopenpresenter.com";
    delete process.env["ELECTRON_RENDERER_URL"];
    delete stored.virtualScreens;
  });

  it("allows the local runtime and the configured host", () => {
    expect(isAllowedAppUrl("http://localhost:45295/o")).toBe(true);
    expect(isAllowedAppUrl("https://theopenpresenter.com/app/x")).toBe(true);
  });

  /**
   * A presentation window carries the preload bridge, so loading someone
   * else's origin would hand them the IPC surface.
   */
  it("refuses origins the app never configured", () => {
    expect(isAllowedAppUrl("https://evil.example.com/x")).toBe(false);
    // A different port is a different origin, and a different server.
    expect(isAllowedAppUrl("http://localhost:9999/o")).toBe(false);
    // Lookalike hostnames must not pass on a prefix match.
    expect(isAllowedAppUrl("https://theopenpresenter.com.evil.tld/")).toBe(
      false,
    );
  });

  it("refuses non-web schemes", () => {
    expect(isAllowedAppUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedAppUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedAppUrl("not a url")).toBe(false);
  });

  it("grants nothing when no server is configured", () => {
    runtimeRef.url = null;
    settings.rootUrl = undefined;
    expect(isAllowedAppUrl("http://localhost:45295/o")).toBe(false);
  });

  /** A screen can come from another signed-in server than the app's own. */
  it("allows hosts a configured screen loads from", () => {
    expect(isAllowedAppUrl("https://church.example.org/render/s/a/b")).toBe(
      false,
    );
    stored.virtualScreens = [
      {
        id: "1",
        source: { kind: "remote", host: "https://church.example.org" },
        orgSlug: "a",
        screenSlug: "b",
        openOnLaunch: true,
      },
    ];
    expect(isAllowedAppUrl("https://church.example.org/render/s/a/b")).toBe(
      true,
    );
  });
});

describe("isShellPage", () => {
  // Absolute on this OS: Windows paths need a drive letter.
  const dir = resolve("/app/out/renderer");
  const file = (path: string) => pathToFileURL(resolve(path)).href;
  it("accepts the app's own pages", () => {
    expect(
      isShellPage(
        `${file("/app/out/renderer/screens.html")}#virtual`,
        undefined,
        dir,
      ),
    ).toBe(true);
    expect(
      isShellPage(
        "http://localhost:5173/screens.html",
        "http://localhost:5173",
        dir,
      ),
    ).toBe(true);
  });
  it("rejects server pages and other files", () => {
    expect(
      isShellPage("https://theopenpresenter.com/o/x", undefined, dir),
    ).toBe(false);
    expect(isShellPage(file("/app/out/other.html"), undefined, dir)).toBe(
      false,
    );
    expect(
      isShellPage(file("/app/out/renderer-evil/x.html"), undefined, dir),
    ).toBe(false);
    expect(
      isShellPage("http://localhost:3000/o/x", "http://localhost:5173", dir),
    ).toBe(false);
    expect(isShellPage(undefined, undefined, dir)).toBe(false);
  });
});
