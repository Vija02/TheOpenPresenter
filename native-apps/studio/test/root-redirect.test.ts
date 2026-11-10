import { describe, expect, it, vi } from "vitest";

import { rootRedirect } from "../src/main/shell/windows";

vi.mock("../src/main/shell/origins", () => ({
  isAllowedAppUrl: (url: string) => !url.includes("elsewhere"),
}));

describe("rootRedirect", () => {
  it("sends a server's root page to /o", () => {
    expect(rootRedirect("http://127.0.0.1:41469/")).toBe(
      "http://127.0.0.1:41469/o",
    );
    expect(rootRedirect("https://theopenpresenter.com/?x=1")).toBe(
      "https://theopenpresenter.com/o",
    );
  });

  it("leaves every other page alone", () => {
    expect(rootRedirect("http://127.0.0.1:41469/o")).toBeNull();
    expect(rootRedirect("http://127.0.0.1:41469/o/church")).toBeNull();
    expect(rootRedirect("https://elsewhere.example/")).toBeNull();
    expect(rootRedirect("file:///index.html")).toBeNull();
  });
});
