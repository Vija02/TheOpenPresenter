import { describe, expect, it } from "vitest";

import {
  fromProjectDateValue,
  fromProjectTimeValue,
  toProjectDateValue,
  toProjectTimeValue,
} from "../projectDate";

describe("project date values", () => {
  it("stores the day as UTC midnight, and reads back the same day", () => {
    const value = toProjectDateValue(new Date(2026, 10, 15));
    expect(value).toBe("2026-11-15T00:00:00.000Z");
    const back = fromProjectDateValue(value);
    expect([back.getFullYear(), back.getMonth(), back.getDate()]).toEqual([
      2026, 10, 15,
    ]);
  });
});

describe("project time values", () => {
  it("round-trips a picked time", () => {
    expect(toProjectTimeValue("10:30")).toBe("10:30:00");
    expect(fromProjectTimeValue("10:30:00")).toBe("10:30");
  });

  it("treats an empty or partial time as none", () => {
    expect(toProjectTimeValue("")).toBeNull();
    expect(toProjectTimeValue(null)).toBeNull();
    expect(toProjectTimeValue("10:")).toBeNull();
    expect(fromProjectTimeValue(null)).toBe("");
  });
});
