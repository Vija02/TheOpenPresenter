import { describe, expect, it } from "vitest";

import { firstStep } from "../src/renderer/onboarding/steps";

describe("firstStep", () => {
  /**
   * `mode` is only written once setup completes, so its absence is what
   * identifies a first run.
   */
  it("starts a fresh install at the role question", () => {
    expect(firstStep({})).toBe("role");
  });

  it("sends a returning user to the screen matching their mode", () => {
    expect(firstStep({ mode: "cloud" })).toBe("signin");
    expect(firstStep({ mode: "selfhosted" })).toBe("signin");
    expect(firstStep({ mode: "local" })).toBe("local");
  });

  /**
   * Answering the role question is not finishing setup: someone who picked
   * "this machine serves" but never got a server running must land back at
   * the start, not a screen that assumes one.
   */
  it("treats an answered role question alone as incomplete", () => {
    expect(firstStep({ autoStartRuntime: true })).toBe("role");
  });
});
