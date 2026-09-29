import { describe, expect, it } from "vitest";

import { normalizeHost } from "../src/main/settings/store";

/**
 * `normalizeHost` decides whether a typed host gets http or https. Getting it
 * wrong either breaks LAN servers (which are plain http) or silently
 * downgrades the public site, so each branch is pinned here.
 */
describe("normalizeHost", () => {
  it("keeps an explicit scheme", () => {
    expect(normalizeHost("http://192.168.1.5:5678")).toBe(
      "http://192.168.1.5:5678",
    );
    expect(normalizeHost("https://theopenpresenter.com")).toBe(
      "https://theopenpresenter.com",
    );
  });

  it("strips trailing slashes so URLs concatenate cleanly", () => {
    expect(normalizeHost("https://example.com/")).toBe("https://example.com");
    expect(normalizeHost("https://example.com///")).toBe("https://example.com");
  });

  it("assumes https for a public hostname", () => {
    expect(normalizeHost("theopenpresenter.com")).toBe(
      "https://theopenpresenter.com",
    );
  });

  it("assumes http for LAN and loopback addresses", () => {
    expect(normalizeHost("localhost:5678")).toBe("http://localhost:5678");
    expect(normalizeHost("127.0.0.1:5678")).toBe("http://127.0.0.1:5678");
    expect(normalizeHost("192.168.1.20:5678")).toBe("http://192.168.1.20:5678");
    expect(normalizeHost("10.0.0.5")).toBe("http://10.0.0.5");
  });

  it("returns empty for blank input rather than a bare scheme", () => {
    expect(normalizeHost("")).toBe("");
    expect(normalizeHost("   ")).toBe("");
  });
});
