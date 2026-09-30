import { net } from "electron";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
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

/**
 * The manager truncates runtime.log on every start and rotates the previous
 * run to runtime.1.log. A runtime that dies before printing anything leaves
 * the current log empty, so a report that only sent the newest file arrived
 * with `"content": "\n"` and no way to tell why the start failed.
 */
describe("diagnostics log collection survives rotation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("includes the rotated log when the current one is empty", async () => {
    const root = mkdtempSync(join(tmpdir(), "top-diag-logs-"));
    mkdirSync(join(root, "logs"), { recursive: true });
    // Exactly the shape the manager leaves behind on a failed start.
    writeFileSync(join(root, "logs", "runtime.log"), "");
    writeFileSync(
      join(root, "logs", "runtime.1.log"),
      "the real reason it failed\n",
    );

    const previousRoot = process.env.TOP_RUNTIME_ROOT;
    process.env.TOP_RUNTIME_ROOT = root;

    let sent: { logs: { name: string; content: string }[] } | null = null;
    vi.spyOn(net, "fetch").mockImplementation((async (
      _url: string,
      init: { body: string },
    ) => {
      sent = JSON.parse(init.body);
      return { ok: true } as Response;
    }) as unknown as typeof net.fetch);

    await reportDiagnosis(`rotation_${Date.now()}`, "");

    if (previousRoot === undefined) delete process.env.TOP_RUNTIME_ROOT;
    else process.env.TOP_RUNTIME_ROOT = previousRoot;

    expect(sent).not.toBeNull();
    const names = sent!.logs.map((l) => l.name);
    expect(names).toContain("runtime.1.log");
    expect(
      sent!.logs.find((l) => l.name === "runtime.1.log")?.content,
    ).toContain("the real reason it failed");
    // The empty current log carries nothing and is left out.
    expect(names).not.toContain("runtime.log");
  });
});
