import { describe, expect, it } from "vitest";

import {
  clearSettings,
  getSettings,
  updateSettings,
} from "../src/main/settings/store";
import { firstStep } from "../src/renderer/onboarding/steps";

/**
 * "Clear and reset data" puts the next launch back at the first screen, so
 * that is what gets asserted rather than the shape of the file it writes.
 */
describe("resetting setup", () => {
  it("sends the next launch back to onboarding", () => {
    updateSettings({ mode: "cloud", rootUrl: "https://example.com" });
    expect(firstStep(getSettings())).toBe("signin");

    clearSettings();

    expect(getSettings()).toEqual({});
    expect(firstStep(getSettings())).toBe("role");
  });

  it("clears local mode too, not just cloud", () => {
    // The case where a server may be running, so the most likely to leave
    // something behind.
    updateSettings({ mode: "local", autoStartRuntime: true });
    expect(firstStep(getSettings())).toBe("local");

    clearSettings();

    expect(firstStep(getSettings())).toBe("role");
    expect(getSettings().autoStartRuntime).toBeUndefined();
  });

  it("survives being called when nothing was saved", () => {
    clearSettings();
    clearSettings();
    expect(getSettings()).toEqual({});
  });
});
