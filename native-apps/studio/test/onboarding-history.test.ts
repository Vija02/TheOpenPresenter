import { describe, expect, it } from "vitest";

import {
  canGoBack,
  current,
  pop,
  push,
} from "../src/renderer/onboarding/history";

describe("onboarding navigation", () => {
  it("offers no way back on the first screen", () => {
    expect(canGoBack(["role"])).toBe(false);
    expect(current(["role"])).toBe("role");
  });

  /**
   * The bug this pins: StrictMode double-invokes updaters, so a push that
   * blindly appends runs twice and the first screen gains a Back button
   * that goes nowhere.
   */
  it("survives StrictMode double-invoking the updater", () => {
    const once = push(["role"], "signin");
    const twice = push(once, "signin");

    expect(twice).toEqual(["role", "signin"]);
    expect(pop(twice)).toEqual(["role"]);
    expect(canGoBack(pop(twice))).toBe(false);
  });

  it("walks forward and back through a full path", () => {
    let stack: ReturnType<typeof push> = ["role"];
    stack = push(stack, "signin");
    stack = push(stack, "organization");
    expect(current(stack)).toBe("organization");

    stack = pop(stack);
    expect(current(stack)).toBe("signin");
    stack = pop(stack);
    expect(current(stack)).toBe("role");
    expect(canGoBack(stack)).toBe(false);
  });

  it("refuses to pop the root", () => {
    expect(pop(["role"])).toEqual(["role"]);
    expect(current(pop(["role"]))).toBe("role");
  });

  /** The same screen is reachable from two places, so Back differs. */
  it("remembers which route reached a shared screen", () => {
    const fromRole = push(["role"], "signin");
    const fromLocal = push(push(["role"], "local"), "signin");

    expect(pop(fromRole)).toEqual(["role"]);
    expect(current(pop(fromLocal))).toBe("local");
  });
});
