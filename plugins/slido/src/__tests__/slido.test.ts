import { describe, expect, it } from "vitest";

import { buildSlidoAdminUrl, buildSlidoUrl, parseSlidoInput } from "../slido";

describe("parseSlidoInput", () => {
  it("reads a present mode link", () => {
    expect(parseSlidoInput("https://wall.sli.do/event/abc123XYZ")).toEqual({
      eventCode: "abc123XYZ",
      section: null,
    });
  });

  it("reads a participant link with a tab", () => {
    expect(
      parseSlidoInput("https://app.sli.do/event/abc123XYZ/questions"),
    ).toEqual({ eventCode: "abc123XYZ", section: null });
  });

  it("reads a host link", () => {
    expect(
      parseSlidoInput("https://admin.sli.do/event/abc123XYZ/polls"),
    ).toEqual({ eventCode: "abc123XYZ", section: null });
  });

  it("keeps the room section", () => {
    expect(
      parseSlidoInput(
        "https://wall.sli.do/event/fPwQwZDFCDE9VoR9i28AHn?section=6428b309-7eaa-4f4c-9b77-365f7c58c99c",
      ),
    ).toEqual({
      eventCode: "fPwQwZDFCDE9VoR9i28AHn",
      section: "6428b309-7eaa-4f4c-9b77-365f7c58c99c",
    });
  });

  it("reads a link pasted without the scheme", () => {
    expect(parseSlidoInput("wall.sli.do/event/abc123XYZ")).toEqual({
      eventCode: "abc123XYZ",
      section: null,
    });
  });

  it("reads a join code, with or without the hash", () => {
    expect(parseSlidoInput("#1234567")).toEqual({
      eventCode: "1234567",
      section: null,
    });
    expect(parseSlidoInput("  1234567 ")).toEqual({
      eventCode: "1234567",
      section: null,
    });
  });

  it("rejects junk", () => {
    expect(parseSlidoInput("")).toBeNull();
    expect(parseSlidoInput("ab")).toBeNull();
    expect(parseSlidoInput("not a code")).toBeNull();
    expect(parseSlidoInput("https://wall.sli.do/")).toBeNull();
  });
});

describe("buildSlidoAdminUrl", () => {
  it("points at the host view, where polls are driven from", () => {
    expect(buildSlidoAdminUrl("abc123")).toBe(
      "https://admin.sli.do/event/abc123",
    );
  });
});

describe("buildSlidoUrl", () => {
  it("always builds the results wall", () => {
    expect(buildSlidoUrl({ eventCode: "abc123" })).toBe(
      "https://wall.sli.do/event/abc123",
    );
  });

  it("carries the section through", () => {
    expect(buildSlidoUrl({ eventCode: "abc123", section: "room-1" })).toBe(
      "https://wall.sli.do/event/abc123?section=room-1",
    );
  });

  it("ignores a null section", () => {
    expect(buildSlidoUrl({ eventCode: "abc123", section: null })).toBe(
      "https://wall.sli.do/event/abc123",
    );
  });
});
