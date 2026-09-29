import { describe, expect, it } from "vitest";

import {
  describeConnection,
  hostLabel,
  needsLocalRuntime,
} from "../src/main/settings/connection";

/**
 * How the app describes what it is connected to.
 *
 * These are the strings a volunteer reads to answer "am I on the cloud or
 * not", so the mapping from stored settings to label is worth pinning.
 */

describe("describeConnection", () => {
  it("treats local mode as serving from this computer", () => {
    const summary = describeConnection(
      { mode: "local" },
      "http://localhost:5678",
    );

    expect(summary.location).toBe("this-computer");
    expect(summary.rootUrl).toBeNull();
    expect(summary.isCloud).toBe(false);
    expect(summary.label).toBe("This computer");
  });

  /**
   * Local mode with nothing running is a real state: the runtime failed to
   * start, or auto-start is off. The label has to say so rather than implying
   * a working server.
   */
  it("says so when local mode has no server running", () => {
    expect(describeConnection({ mode: "local" }, null).label).toBe(
      "This computer (not running)",
    );
  });

  it("recognises the cloud by its URL rather than the stored mode", () => {
    // The mode field has drifted before; the URL is the thing that decides
    // where traffic actually goes.
    const summary = describeConnection(
      { mode: "selfhosted", rootUrl: "https://theopenpresenter.com" },
      null,
    );

    expect(summary.isCloud).toBe(true);
    expect(summary.mode).toBe("cloud");
    expect(summary.label).toBe("TheOpenPresenter Cloud");
  });

  it("ignores a trailing slash when identifying the cloud", () => {
    const summary = describeConnection(
      { mode: "cloud", rootUrl: "https://theopenpresenter.com/" },
      null,
    );

    expect(summary.isCloud).toBe(true);
  });

  it("labels a self-hosted server by host", () => {
    const summary = describeConnection(
      { mode: "selfhosted", rootUrl: "https://presenter.mychurch.org" },
      null,
    );

    expect(summary.isCloud).toBe(false);
    expect(summary.mode).toBe("selfhosted");
    expect(summary.label).toBe("presenter.mychurch.org");
  });

  it("defaults to the cloud when no server was ever chosen", () => {
    const summary = describeConnection({}, null);

    expect(summary.location).toBe("remote");
    expect(summary.isCloud).toBe(true);
  });
});

describe("hostLabel", () => {
  it("reduces a URL to its host", () => {
    expect(hostLabel("https://presenter.mychurch.org/o/x")).toBe(
      "presenter.mychurch.org",
    );
  });

  it("keeps the port, which distinguishes two servers on one box", () => {
    expect(hostLabel("http://192.168.1.10:5678")).toBe("192.168.1.10:5678");
  });

  it("returns unparseable input unchanged rather than throwing", () => {
    expect(hostLabel("not a url")).toBe("not a url");
  });
});

describe("needsLocalRuntime", () => {
  /**
   * The distinction that makes switching to a remote server easy: it does not
   * require the 140MB runtime to be installed or running.
   */
  it("only requires the runtime when serving from this computer", () => {
    expect(needsLocalRuntime("this-computer")).toBe(true);
    expect(needsLocalRuntime("remote")).toBe(false);
  });
});
