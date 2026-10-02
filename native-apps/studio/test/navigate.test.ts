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

/**
 * Onboarding knows which organisation the user just picked. Without passing
 * it, the window lands on `/o`, which prefers the organisation the browser
 * last remembered and otherwise takes the first in the list — so an install
 * with a second organisation opens the wrong one.
 */
describe("opening a named organisation", () => {
  it("lands directly on the organisation it was given", () => {
    expect(target("http://localhost:45231", "interview-test")).toBe(
      "http://localhost:45231/o/interview-test",
    );
  });

  it("still falls back to the picker without one", () => {
    expect(target("http://localhost:45231", undefined)).toBe(
      "http://localhost:45231/o",
    );
  });

  /** A mirror of an existing name is uniquified, so the slug can differ. */
  it("uses the slug given rather than guessing", () => {
    expect(target("http://localhost:45231/", "grace-2")).toBe(
      "http://localhost:45231/o/grace-2",
    );
  });

  it("escapes a slug so it cannot alter the path", () => {
    expect(target("http://localhost:45231", "a/../login")).toBe(
      "http://localhost:45231/o/a%2F..%2Flogin",
    );
  });

  /** A caller that already has a destination is still left alone. */
  it("does not override an explicit path", () => {
    expect(target("http://localhost:45231/login", "grace")).toBe(
      "http://localhost:45231/login",
    );
  });
});
