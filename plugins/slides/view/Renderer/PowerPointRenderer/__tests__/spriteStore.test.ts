import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The store is module-level (sheets outlive renders), so each test loads it fresh
const loadStore = async () => {
  vi.resetModules();
  return import("../spriteStore");
};

const fetchMock = vi.fn();
const decodeMock = vi.fn(() => Promise.resolve());
let blobCount = 0;

beforeEach(() => {
  blobCount = 0;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) =>
    url.includes("broken")
      ? { ok: false, status: 404 }
      : { ok: true, blob: async () => new Blob([url]) },
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => `blob:${++blobCount}`,
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode = decodeMock;
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  decodeMock.mockClear();
});

describe("useSpriteStore", () => {
  it("downloads each sheet once and then draws it from memory", async () => {
    const { useSpriteStore } = await loadStore();
    const props = {
      all: ["a.webp", "b.webp"],
      required: ["a.webp"],
      decodeUrls: [],
    };
    const { result, rerender } = renderHook((p) => useSpriteStore(p), {
      initialProps: props,
    });

    await waitFor(() => expect(result.current.allLoaded).toBe(true));
    expect(result.current.ready).toBe(true);
    expect(result.current.resolve("a.webp")).toMatch(/^blob:/);

    // Same sheets again, as on the next slide: nothing new is fetched
    rerender({ ...props, all: [...props.all] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the network url when a download fails", async () => {
    const { useSpriteStore } = await loadStore();
    const { result } = renderHook(() =>
      useSpriteStore({ all: ["broken.webp"], required: [], decodeUrls: [] }),
    );
    await waitFor(() => expect(result.current.allLoaded).toBe(true));
    expect(result.current.resolve("broken.webp")).toBe("broken.webp");
  });

  it("lets go of sheets no slide uses any more", async () => {
    const { useSpriteStore } = await loadStore();
    const { result, rerender } = renderHook((p) => useSpriteStore(p), {
      initialProps: { all: ["a.webp", "b.webp"], required: [], decodeUrls: [] },
    });
    await waitFor(() => expect(result.current.allLoaded).toBe(true));
    rerender({ all: ["a.webp"], required: [], decodeUrls: [] });
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
