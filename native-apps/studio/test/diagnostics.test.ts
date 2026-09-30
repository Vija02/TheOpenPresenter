import { net } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportDiagnosis } from "../src/main/shell/diagnostics";

/**
 * A crash-restart loop calls this on every restart. Without throttling the
 * first and most useful report is buried under identical copies, and the
 * endpoint takes the whole loop.
 */
describe("diagnostics reporting is throttled", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the first report and suppresses an identical one", async () => {
    const fetch = vi
      .spyOn(net, "fetch")
      .mockResolvedValue({ ok: true } as Response);

    const reason = `test_reason_${Date.now()}`;

    await reportDiagnosis(reason, "first");
    await reportDiagnosis(reason, "second");
    await reportDiagnosis(reason, "third");

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not let one failure suppress a different one", async () => {
    const fetch = vi
      .spyOn(net, "fetch")
      .mockResolvedValue({ ok: true } as Response);

    const stamp = Date.now();
    await reportDiagnosis(`reason_a_${stamp}`, "");
    await reportDiagnosis(`reason_b_${stamp}`, "");

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
