import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readers, grabs } = vi.hoisted(() => ({
  readers: [] as { onKey: (code: number) => void; closed: boolean }[],
  /** What the next grab answers: null when it works. */
  grabs: { next: null as string | null, count: 0 },
}));

vi.mock("../src/main/screens/evdev", async (original) => ({
  ...(await original<typeof import("../src/main/screens/evdev")>()),
  listInputDevices: async () => [
    { id: "0148:08da", name: "USB RF PRESENT", paths: ["/dev/input/event8"] },
    { id: "046d:c07e", name: "Other Presenter", paths: ["/dev/input/event9"] },
  ],
  canGrab: () => true,
  openNode: (_path: string, onKey: (code: number) => void) => {
    const r = { onKey, closed: false };
    readers.push(r);
    return {
      ok: true,
      reader: {
        close: () => (r.closed = true),
        grab: async () => {
          grabs.count++;
          return grabs.next;
        },
      },
    };
  },
}));

import {
  clickerStatus,
  getClickerConfig,
  saveClickerConfig,
  startClickerTest,
  stopClickerTest,
} from "../src/main/screens/clicker";

function fakeOwner(sent: unknown[] = []) {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    isDestroyed: () => false,
    send: (_channel: string, payload: unknown) => sent.push(payload),
  }) as unknown as Electron.WebContents & EventEmitter;
}

const navigation = (isSameDocument: boolean) => ({
  isMainFrame: true,
  isSameDocument,
});

describe("finding the clicker", () => {
  beforeEach(() => {
    stopClickerTest();
    readers.length = 0;
  });

  it("hears each press once when starts overlap", async () => {
    const sent: unknown[] = [];
    const owner = fakeOwner(sent);

    // What React's StrictMode does on mount in development.
    const first = startClickerTest(owner);
    stopClickerTest();
    const second = startClickerTest(owner);
    await Promise.all([first, second]);

    // One reader per device's node, not two.
    const open = readers.filter((r) => !r.closed);
    expect(open).toHaveLength(2);
    open[0]!.onKey(109);
    expect(sent).toEqual([
      { device: { id: "0148:08da", name: "USB RF PRESENT" }, key: "NEXT" },
    ]);

    stopClickerTest();
    expect(readers.every((r) => r.closed)).toBe(true);
  });

  it("stops when its window reloads, not on an in-page change", async () => {
    const owner = fakeOwner();
    await startClickerTest(owner);

    owner.emit("did-start-navigation", navigation(true));
    expect(readers.some((r) => !r.closed)).toBe(true);

    owner.emit("did-start-navigation", navigation(false));
    expect(readers.every((r) => r.closed)).toBe(true);
  });

  it("stops when its window crashes", async () => {
    const owner = fakeOwner();
    await startClickerTest(owner);
    owner.emit("render-process-gone");
    expect(readers.every((r) => r.closed)).toBe(true);
  });
});

const settle = () => new Promise((r) => setTimeout(r, 0));
const PRESENTER = { id: "0148:08da", name: "USB RF PRESENT" };

// Capturing only happens on Linux.
describe.runIf(process.platform === "linux")("capturing", () => {
  beforeEach(() => {
    saveClickerConfig({ enabled: false });
    readers.length = 0;
    grabs.next = null;
    grabs.count = 0;
  });

  it("gives a keyboard back once it types letters", async () => {
    saveClickerConfig({ enabled: true, device: PRESENTER });
    await settle();
    const live = readers.find((r) => !r.closed)!;

    live.onKey(48); // B, as a clicker's blank-screen button sends
    live.onKey(30);
    expect(getClickerConfig().enabled).toBe(true);
    live.onKey(31); // a third different letter: a keyboard

    expect(getClickerConfig().enabled).toBe(false);
    expect(readers.every((r) => r.closed)).toBe(true);
    const status = clickerStatus();
    expect(status.supported && status.notice).toMatch(/looks like a keyboard/);

    saveClickerConfig({ enabled: true });
    const after = clickerStatus();
    expect(after.supported && after.notice).toBeNull();
  });

  it("forgets letters when the device changes", async () => {
    saveClickerConfig({ enabled: true, device: PRESENTER });
    await settle();
    const first = readers.find((r) => !r.closed)!;
    first.onKey(30);
    first.onKey(31);

    saveClickerConfig({
      device: { id: "046d:c07e", name: "Other Presenter" },
    });
    await settle();
    readers.find((r) => !r.closed)!.onKey(48); // its blank-screen B
    expect(getClickerConfig().enabled).toBe(true);
  });

  it("tries a failed grab again", async () => {
    vi.useFakeTimers();
    try {
      grabs.next = "Device or resource busy";
      saveClickerConfig({ enabled: true, device: PRESENTER });
      await vi.advanceTimersByTimeAsync(0);
      const before = clickerStatus();
      expect(before.supported && before.grabbed).toBe(false);

      // Whatever held it lets go; the next pass takes it.
      grabs.next = null;
      await vi.advanceTimersByTimeAsync(3000);
      const after = clickerStatus();
      expect(after.supported && after.grabbed).toBe(true);
      expect(readers.filter((r) => !r.closed)).toHaveLength(1);

      // Once taken, no more tries.
      const tries = grabs.count;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(grabs.count).toBe(tries);
    } finally {
      vi.useRealTimers();
    }
  });
});
