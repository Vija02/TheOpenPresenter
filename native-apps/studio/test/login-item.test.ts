import { describe, expect, it } from "vitest";

import { desktopExec, loginItemState } from "../src/main/screens/loginItem";

const base = {
  platform: "darwin" as NodeJS.Platform,
  packaged: true,
  inApplications: true,
  enabled: true,
};

describe("loginItemState", () => {
  it("is unavailable in a dev build, which would start bare Electron", () => {
    expect(loginItemState({ ...base, packaged: false })).toMatchObject({
      status: "unavailable",
    });
  });

  it("asks to move the app into Applications on macOS first", () => {
    expect(loginItemState({ ...base, inApplications: false })).toEqual({
      status: "unavailable",
      reason: "Move TheOpenPresenter to Applications first.",
    });
  });

  it("says when macOS is waiting for the user to allow it", () => {
    expect(
      loginItemState({
        ...base,
        enabled: false,
        macStatus: "requires-approval",
      }),
    ).toEqual({ status: "needs-approval" });
  });

  it("reports on and off elsewhere", () => {
    expect(loginItemState({ ...base, platform: "win32" })).toEqual({
      status: "on",
    });
    expect(
      loginItemState({
        ...base,
        platform: "linux",
        inApplications: false,
        enabled: false,
      }),
    ).toEqual({ status: "off" });
  });
});

describe("desktopExec", () => {
  it("quotes a path with spaces", () => {
    expect(desktopExec("/opt/The Open Presenter/top")).toBe(
      '"/opt/The Open Presenter/top"',
    );
  });

  it("escapes what the desktop entry spec reserves", () => {
    // Quoting escapes the character; the string value escapes the backslash.
    expect(desktopExec('/a"b')).toBe('"/a\\\\"b"');
    expect(desktopExec("/a$b`c")).toBe('"/a\\\\$b\\\\`c"');
    expect(desktopExec("/a\\b")).toBe('"/a\\\\\\\\b"');
    expect(desktopExec("/100%/top")).toBe('"/100%%/top"');
  });
});
