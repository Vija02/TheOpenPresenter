import { beforeEach, describe, expect, it, vi } from "vitest";

describe("watchLinkedFiles", () => {
  let sent: string[][];
  let emit: (filePath: string) => void;

  beforeEach(() => {
    vi.resetModules();
    sent = [];
    vi.stubGlobal("window", {
      theOpenPresenterDesktop: {
        watchLinkedFiles: async (paths: string[]) => {
          sent.push(paths);
          return paths;
        },
        on: (_channel: string, handler: (payload: unknown) => void) => {
          emit = handler;
          return () => {};
        },
      },
    });
  });

  it("sends every caller's paths, and keeps one when the other stops", async () => {
    const { watchLinkedFiles } = await import("../files");
    const a = vi.fn();
    const b = vi.fn();
    const stopA = watchLinkedFiles(["/a.pptx"], a);
    watchLinkedFiles(["/b.pptx", "/a.pptx"], b);
    expect(sent.at(-1)).toEqual(["/a.pptx", "/b.pptx"]);

    emit("/b.pptx");
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith("/b.pptx");

    stopA();
    expect(sent.at(-1)).toEqual(["/b.pptx", "/a.pptx"]);
    emit("/a.pptx");
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith("/a.pptx");
  });

  it("clears the list when the last caller stops", async () => {
    const { watchLinkedFiles } = await import("../files");
    watchLinkedFiles(["/a.pptx"], vi.fn())();
    expect(sent.at(-1)).toEqual([]);
  });
});
