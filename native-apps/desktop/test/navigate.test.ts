import { describe, expect, it } from "vitest";

import { appEntryUrl as target } from "../src/main/shell/windows";

/**
 * `/` is the marketing homepage, which a packaged runtime does not contain:
 * landing there is a 404 locally and a sales page on the cloud.
 */

describe("where the window lands", () => {
  it("sends a bare origin to the organisation picker", () => {
    expect(target("http://localhost:45231")).toBe("http://localhost:45231/o");
    expect(target("https://theopenpresenter.com")).toBe(
      "https://theopenpresenter.com/o",
    );
  });

  it("treats a trailing slash as bare", () => {
    expect(target("http://localhost:45231/")).toBe("http://localhost:45231/o");
  });

  it("leaves a specific path alone", () => {
    // Callers that already know where they are going must not be rewritten.
    expect(target("http://localhost:45231/o/my-church")).toBe(
      "http://localhost:45231/o/my-church",
    );
    expect(target("http://localhost:45231/login")).toBe(
      "http://localhost:45231/login",
    );
  });

  it("preserves a query or fragment on the root", () => {
    // `/?invite=abc` is meaningful; rewriting would drop the user somewhere
    // that ignores it.
    expect(target("http://localhost:45231/?invite=abc")).toBe(
      "http://localhost:45231/?invite=abc",
    );
  });

  it("passes through anything unparseable", () => {
    expect(target("not a url")).toBe("not a url");
  });
});
