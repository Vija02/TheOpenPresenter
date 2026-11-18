import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (...args: unknown[]) => unknown;

const { handlers, listeners, shell } = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  listeners: new Map<string, Handler>(),
  shell: { dir: "" },
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, fn: Handler) => handlers.set(channel, fn),
    on: (channel: string, fn: Handler) => listeners.set(channel, fn),
  },
}));
vi.mock("../src/main/settings/paths", () => ({
  shellDir: () => shell.dir,
}));
vi.mock("../src/main/settings/store", () => ({
  computerAt: (url: string) =>
    url === "http://localhost:4100" ? { peer: "peer-b", port: 4100 } : null,
}));
vi.mock("../src/main/runtime/helper", () => ({
  helper: { nodeId: async () => "a".repeat(64) },
}));

const { registerLinkedFilesIPC } = await import("../src/main/files/linked");
registerLinkedFilesIPC();

let nextId = 1;
const page = (origin: string) => {
  const sent: unknown[][] = [];
  const sender = {
    id: nextId++,
    isDestroyed: () => false,
    once: () => {},
    send: (...args: unknown[]) => sent.push(args),
  };
  return { event: { sender, senderFrame: { origin } }, sent };
};

const allow = (from: ReturnType<typeof page>, filePath: string) =>
  listeners.get("linked-files:allow")!(from.event, filePath);
const read = (from: ReturnType<typeof page>, filePath: unknown) =>
  handlers.get("linked-files:read")!(from.event, filePath) as Promise<Buffer>;
const watchFiles = (from: ReturnType<typeof page>, filePaths: string[]) =>
  handlers.get("linked-files:watch")!(from.event, filePaths) as string[];

describe("linked files", () => {
  let deck: string;

  beforeEach(() => {
    shell.dir = mkdtempSync(join(tmpdir(), "shell-"));
    deck = join(mkdtempSync(join(tmpdir(), "linked-")), "deck.pptx");
    writeFileSync(deck, "pptx");
  });

  it("won't read a file the user didn't pick", async () => {
    const b = page("http://localhost:4100");
    await expect(read(b, deck)).rejects.toThrow(/wasn't linked/);
    await expect(read(b, 123)).rejects.toThrow(/wasn't linked/);
  });

  it("reads a file once the preload allowed it", async () => {
    const b = page("http://localhost:4100");
    allow(b, deck);
    expect((await read(b, deck)).toString()).toBe("pptx");
  });

  it("keeps a file to the server it was linked on", async () => {
    allow(page("http://localhost:4100"), deck);
    const c = page("http://localhost:4200");
    await expect(read(c, deck)).rejects.toThrow(/wasn't linked/);
    expect(watchFiles(c, [deck])).toEqual([]);
  });

  it("saves to its own file, by peer rather than port", async () => {
    allow(page("http://localhost:4100"), deck);
    expect(
      JSON.parse(readFileSync(join(shell.dir, "linked-files.json"), "utf8")),
    ).toEqual([{ host: "peer-b", path: deck }]);
  });

  it("only allows through the preload's one-way channel", () => {
    expect(handlers.has("linked-files:allow")).toBe(false);
  });

  it("tells one page about a save, however many watch it", async () => {
    vi.useFakeTimers();
    try {
      const first = page("http://localhost:4100");
      const second = page("http://localhost:4100");
      allow(first, deck);
      expect(watchFiles(first, [deck])).toEqual([deck]);
      expect(watchFiles(second, [deck])).toEqual([deck]);
      await vi.advanceTimersByTimeAsync(3100);
      expect(first.sent).toEqual([["linked-files:changed", deck]]);
      expect(second.sent).toEqual([]);

      watchFiles(first, []);
      writeFileSync(deck, "v2");
      await vi.waitFor(async () => {
        await vi.advanceTimersByTimeAsync(3100);
        expect(second.sent).toEqual([["linked-files:changed", deck]]);
      });
      watchFiles(second, []);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives the node id", async () => {
    expect(await handlers.get("app:node-id")!({})).toBe("a".repeat(64));
  });
});
