import { describe, expect, it, vi } from "vitest";

/**
 * Signing in before the download finishes must not connect early, or
 * `runtime:start` runs against a runtime that is not there yet. The wait is on
 * the install promise rather than polled state, because a poll can sample
 * between "active false" and "done true" and see neither.
 */
describe("finishing setup while the download is still running", () => {
  it("waits for the in-flight install before starting the server", async () => {
    const order: string[] = [];
    let finishInstall: () => void = () => {};
    const install = new Promise<void>((resolve) => {
      finishInstall = () => {
        order.push("install-done");
        resolve();
      };
    });

    // Mirrors the hook: `wait` returns the in-flight promise.
    const inFlight = { current: install as Promise<void> | null };
    const wait = () => inFlight.current ?? Promise.resolve();

    const start = vi.fn(async () => {
      order.push("server-start");
    });

    // Sign-in completes first, while the download is still going.
    order.push("signed-in");
    const finishing = (async () => {
      await wait();
      await start();
    })();

    // The server must not have started yet.
    await Promise.resolve();
    expect(start).not.toHaveBeenCalled();

    finishInstall();
    await finishing;

    expect(order).toEqual(["signed-in", "install-done", "server-start"]);
  });

  it("does not wait when nothing is downloading", async () => {
    const inFlight = { current: null as Promise<void> | null };
    const wait = () => inFlight.current ?? Promise.resolve();

    const start = vi.fn(async () => {});
    await wait();
    await start();

    expect(start).toHaveBeenCalledOnce();
  });

  it("surfaces a failed download instead of starting a missing runtime", async () => {
    const failed = Promise.reject(new Error("network died"));
    // Attach a handler immediately so the rejection is never unhandled.
    failed.catch(() => {});

    const inFlight = { current: failed as Promise<void> | null };
    const wait = () => inFlight.current ?? Promise.resolve();
    const start = vi.fn(async () => {});

    await expect(
      (async () => {
        await wait();
        await start();
      })(),
    ).rejects.toThrow("network died");

    expect(start).not.toHaveBeenCalled();
  });
});
