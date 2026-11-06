// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PublicLinkError,
  parseCanvaLink,
  parseGoogleSlidesLink,
  resolveCanvaShortLink,
} from "../publicLinks";

const DECK_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefg";

describe("parseGoogleSlidesLink", () => {
  it.each([
    `https://docs.google.com/presentation/d/${DECK_ID}/edit?usp=sharing`,
    `https://docs.google.com/presentation/d/${DECK_ID}/edit#slide=id.p`,
    `https://docs.google.com/presentation/d/${DECK_ID}`,
    `https://docs.google.com/presentation/u/1/d/${DECK_ID}/view`,
    `https://docs.google.com/a/example.org/presentation/d/${DECK_ID}/edit`,
    `docs.google.com/presentation/d/${DECK_ID}/present`,
    `  https://docs.google.com/presentation/d/${DECK_ID}/edit  `,
  ])("reads the deck id from %s", (link) => {
    expect(parseGoogleSlidesLink(link)).toBe(DECK_ID);
  });

  it.each([
    "",
    "not a link",
    `https://docs.google.com/document/d/${DECK_ID}/edit`,
    `https://evil.example/presentation/d/${DECK_ID}/edit`,
    `https://docs.google.com.evil.example/presentation/d/${DECK_ID}`,
    "https://docs.google.com/presentation/d/short/edit",
  ])("rejects %s", (link) => {
    expect(() => parseGoogleSlidesLink(link)).toThrow(PublicLinkError);
  });

  it("explains that publish-to-web links can't be used", () => {
    expect(() =>
      parseGoogleSlidesLink(
        "https://docs.google.com/presentation/d/e/2PACX-1vabcdefghijklmnopqrstuvwxyz/pub",
      ),
    ).toThrow(/Publish to the web/);
  });
});

describe("parseCanvaLink", () => {
  it.each([
    "https://www.canva.com/design/DAHZVxdlw64/FImGB-OG5kox4VzutjwQRQ/view",
    "https://www.canva.com/design/DAHZVxdlw64/FImGB-OG5kox4VzutjwQRQ/edit?utm_content=DAHZVxdlw64&utm_source=sharebutton",
    "canva.com/design/DAHZVxdlw64/view",
  ])("reads the design id from %s", (link) => {
    expect(parseCanvaLink(link)).toEqual({
      kind: "design",
      designId: "DAHZVxdlw64",
    });
  });

  it("recognises short links", () => {
    expect(parseCanvaLink("https://canva.link/ep70fufjjj9ht6r")).toEqual({
      kind: "short",
      code: "ep70fufjjj9ht6r",
    });
  });

  it.each([
    "",
    "https://www.canva.com/",
    "https://www.canva.com.evil.example/design/DAHZVxdlw64/view",
    "https://evil.example/design/DAHZVxdlw64/view",
    "https://canva.link/",
  ])("rejects %s", (link) => {
    expect(() => parseCanvaLink(link)).toThrow(PublicLinkError);
  });
});

describe("resolveCanvaShortLink", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Answers each request with the next redirect, or none. */
  const redirects = (...locations: (string | null)[]) => {
    const fetched: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        fetched.push(url.toString());
        const location = locations.shift() ?? null;
        return {
          status: location ? 301 : 200,
          headers: {
            get: (name: string) => (name === "location" ? location : null),
          },
        };
      }),
    );
    return fetched;
  };

  it("follows an absolute redirect to the design", async () => {
    redirects("https://www.canva.com/design/DAHZVxdlw64/abc/edit");
    await expect(resolveCanvaShortLink("ep70")).resolves.toBe("DAHZVxdlw64");
  });

  it("follows chained and relative redirects", async () => {
    const fetched = redirects(
      "https://www.canva.com/link?target=x",
      "/design/DAHZVxdlw64/abc/view",
    );
    await expect(resolveCanvaShortLink("ep70")).resolves.toBe("DAHZVxdlw64");
    expect(fetched).toEqual([
      "https://canva.link/ep70",
      "https://www.canva.com/link?target=x",
    ]);
  });

  it("never follows a redirect off Canva", async () => {
    const fetched = redirects("https://evil.example/design/DAHZVxdlw64/abc");
    await expect(resolveCanvaShortLink("ep70")).rejects.toThrow(
      "doesn't lead to a design",
    );
    expect(fetched).toHaveLength(1);
  });

  it("gives up on a link that goes nowhere", async () => {
    redirects(null);
    await expect(resolveCanvaShortLink("ep70")).rejects.toThrow(
      PublicLinkError,
    );
  });

  it("explains a network failure plainly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted", "TimeoutError");
      }),
    );
    await expect(resolveCanvaShortLink("ep70")).rejects.toThrow(
      "Couldn't reach Canva",
    );
  });
});
