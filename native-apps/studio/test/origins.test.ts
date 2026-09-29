import { beforeEach, describe, expect, it, vi } from "vitest";

const settings = { rootUrl: undefined as string | undefined };
const runtimeRef = { url: null as string | null };

vi.mock("electron", () => ({ shell: { openExternal: vi.fn() } }));
vi.mock("../src/main/settings/store", () => ({
  getSettings: () => settings,
}));
vi.mock("../src/main/runtime/client", () => ({
  runtime: runtimeRef,
}));

const { isAllowedAppUrl } = await import("../src/main/shell/origins");

describe("isAllowedAppUrl", () => {
  beforeEach(() => {
    runtimeRef.url = "http://localhost:45295";
    settings.rootUrl = "https://theopenpresenter.com";
    delete process.env["ELECTRON_RENDERER_URL"];
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
});
