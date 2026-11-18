// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkLinkRequest, parseLinkedPath } from "../office/local/linkedFiles";

describe("parseLinkedPath", () => {
  it("accepts a full path to a deck", () => {
    expect(parseLinkedPath("/home/me/My Deck.pptx")).toBe(
      "/home/me/My Deck.pptx",
    );
  });

  it("accepts a Windows path on any server", () => {
    expect(parseLinkedPath("C:\\Users\\me\\deck.pptx")).toBe(
      "C:\\Users\\me\\deck.pptx",
    );
  });

  it("rejects a relative path", () => {
    expect(() => parseLinkedPath("deck.pptx")).toThrow(/Couldn't find/);
  });

  it("rejects other file types", () => {
    expect(() => parseLinkedPath("/home/me/notes.txt")).toThrow(/PowerPoint/);
  });
});

describe("checkLinkRequest", () => {
  const nodeId = "ab".repeat(32);

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("only links in Studio's runtime", () => {
    vi.stubEnv("TOP_MANAGED", "");
    expect(() =>
      checkLinkRequest({ path: "/home/me/deck.pptx", watchedBy: nodeId }),
    ).toThrow(/Studio/);
  });

  it("needs a real node id", () => {
    vi.stubEnv("TOP_MANAGED", "1");
    expect(() =>
      checkLinkRequest({ path: "/home/me/deck.pptx", watchedBy: "not-an-id" }),
    ).toThrow(/which computer/);
  });

  it("takes a full path to a deck from a known computer", () => {
    vi.stubEnv("TOP_MANAGED", "1");
    expect(
      checkLinkRequest({ path: "/home/me/deck.pptx", watchedBy: nodeId }),
    ).toEqual({
      path: "/home/me/deck.pptx",
      watchedBy: nodeId,
    });
  });
});
