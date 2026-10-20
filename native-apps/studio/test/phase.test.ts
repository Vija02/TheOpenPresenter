import { describe, expect, it } from "vitest";

import {
  describeLogLine,
  describePhase,
  describeProgress,
} from "../src/renderer/loading/phase";

describe("describePhase", () => {
  it("names the install phases", () => {
    expect(describePhase("download")).toBe("Downloading");
    expect(describePhase("assemble")).toBe("Installing");
    expect(describePhase("starting")).toBe("Starting up");
  });

  it("handles the phases that carry a version", () => {
    expect(describePhase("resolved:1.2.3")).toBe("Checking for updates");
    expect(describePhase("activated:1.2.3")).toBe("Almost ready");
  });

  it("says nothing rather than leaking an internal name", () => {
    expect(describePhase("verify_blobs")).toBeNull();
    expect(describePhase("")).toBeNull();
  });

  it("does not leak the version from a prefixed phase", () => {
    expect(describePhase("resolved:0.0.7-dev")).not.toContain("0.0.7");
  });
});

describe("describeProgress", () => {
  const MB = 1024 * 1024;

  it("shows bytes while a pack downloads", () => {
    expect(
      describeProgress({ phase: "fetch", done: 120 * MB, total: 480 * MB }),
    ).toEqual({ label: "Downloading 120.0 MB of 480.0 MB", percent: 25 });
  });

  it("still says something when the size is unknown", () => {
    expect(
      describeProgress({ phase: "fetch", done: 3 * MB, total: 0 }),
    ).toEqual({ label: "Downloading 3.0 MB", percent: null });
  });

  it("counts files once the pack is in", () => {
    const view = describeProgress({ phase: "download", done: 50, total: 200 });
    expect(view.percent).toBe(25);
    expect(view.label).toContain("50");
    expect(describeProgress({ phase: "assemble", done: 1, total: 4 })).toEqual({
      label: "Installing",
      percent: 25,
    });
  });

  it("never reports past 100%", () => {
    expect(
      describeProgress({ phase: "fetch", done: 2 * MB, total: MB }).percent,
    ).toBe(100);
  });

  it("sweeps for phases without a count", () => {
    expect(
      describeProgress({ phase: "resolved:1.2.3", done: 0, total: 0 }),
    ).toEqual({ label: "Checking for updates", percent: null });
    expect(describeProgress({ phase: "mystery", done: 0, total: 0 })).toEqual({
      label: "Working",
      percent: null,
    });
  });
});

describe("describeLogLine", () => {
  /**
   * The exact lines a real start emits, in order, taken from a timed run
   * rather than from reading the source.
   */
  it("names each startup milestone", () => {
    expect(describeLogLine("Initializing node server!")).toBe(
      "Starting the database",
    );
    expect(
      describeLogLine(
        "2026-09-28 11:15:50.796 BST [1] LOG:  database system is ready to accept connections",
      ),
    ).toBe("Database ready");
    expect(describeLogLine("Running migrations...")).toBe(
      "Updating the database",
    );
    expect(describeLogLine("Starting Worker...")).toBe(
      "Starting background jobs",
    );
    expect(describeLogLine("Starting Node Server...")).toBe(
      "Starting the server",
    );
    expect(describeLogLine("11 plugins initialized! audio, ...")).toBe(
      "Loading plugins",
    );
    expect(describeLogLine("TheOpenPresenter listening on port 45297")).toBe(
      "Ready",
    );
  });

  /** The noise this filter keeps off the screen. */
  it("ignores the noise", () => {
    expect(
      describeLogLine(
        "[vite-express] Inline config detected, ignoring Vite config file",
      ),
    ).toBeNull();
    expect(
      describeLogLine('::1 - - [28/Sep/2026] "GET /o HTTP/1.1" 200 2726'),
    ).toBeNull();
    expect(describeLogLine("")).toBeNull();
  });

  /** "Running migrations" also contains "database", so order matters. */
  it("does not confuse migrations with the database being ready", () => {
    expect(describeLogLine("Running migrations...")).toBe(
      "Updating the database",
    );
  });
});

/**
 * Matching is on substrings of another codebase's output, so it will go stale.
 * When it does, the loading window must degrade to saying less, never to
 * crashing or dumping a raw log line on screen.
 */
describe("resilience to log changes", () => {
  it("never throws, whatever arrives", () => {
    const hostile = [
      "",
      "   ",
      "\u0000",
      "x".repeat(100000),
      "<script>alert(1)</script>",
      "[object Object]",
      "Bootstrapping embedded database (renamed)",
    ];
    for (const line of hostile) {
      expect(() => describeLogLine(line)).not.toThrow();
      expect(() => describePhase(line)).not.toThrow();
    }
  });

  it("shows nothing rather than a raw line it does not understand", () => {
    // Unrecognised, so the caller keeps the previous message instead of
    // printing server internals.
    expect(describeLogLine("PostgreSQL cluster online")).toBeNull();
    expect(describeLogLine("Spawning job runner")).toBeNull();
  });
});
