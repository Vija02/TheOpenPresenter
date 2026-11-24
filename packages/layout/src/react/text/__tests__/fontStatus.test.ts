// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const load = async () => {
  vi.resetModules();
  const status = await import("../fontStatus");
  const registry = await import("@repo/layout");
  return { ...status, ...registry };
};

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load: vi.fn(() => Promise.resolve([])), addEventListener() {} },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("missing fonts", () => {
  it("are reported again, less and less often, until they turn up", async () => {
    const { ensureFontsLoaded, subscribeToMissingFonts, setOrganizationFonts } =
      await load();
    const reports: string[] = [];
    subscribeToMissingFonts((f) => reports.push(f));

    ensureFontsLoaded(['"Lora", serif']);
    ensureFontsLoaded(['"Lora", serif']);
    expect(reports).toEqual(["lora"]);

    // Asked again once the first wait is over, then after a longer one
    await vi.advanceTimersByTimeAsync(15_000);
    expect(reports).toEqual(["lora", "lora"]);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(reports).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(reports).toHaveLength(3);

    // Once it exists, no more reports
    setOrganizationFonts([
      { family: "Lora", category: "serif", cssUrl: "/media/data/a.css" },
    ]);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(reports).toHaveLength(3);
  });
});
