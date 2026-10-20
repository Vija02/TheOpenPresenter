import { afterEach, describe, expect, it, vi } from "vitest";

// Detection is remembered per page load, so each case gets a fresh module
const load = async () => {
  vi.resetModules();
  return {
    ...(await import("../imageSupport")),
    ...(await import("../mediaUtil")),
  };
};

const browser = ({
  canvasWebP,
  decodes,
}: {
  canvasWebP: boolean;
  decodes?: boolean;
}) => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", {
    createElement: () => ({
      toDataURL: (type: string) =>
        canvasWebP && type === "image/webp"
          ? "data:image/webp;base64,x"
          : "data:image/png;base64,x",
    }),
  });
  vi.stubGlobal(
    "Image",
    class {
      width = 0;
      height = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => {
          if (decodes) {
            this.width = this.height = 1;
            this.onload?.();
          } else {
            this.onerror?.();
          }
        });
      }
    },
  );
};

const NAME = { mediaId: "media_01kn2cpae5fk7adpbteae5tgyg", extension: "png" };
const HOST = "http://localhost:5678";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebP support", () => {
  it("is off outside a browser", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("Image", undefined);
    const { detectWebPSupport, getWebPSupport } = await load();
    await expect(detectWebPSupport()).resolves.toBe(false);
    expect(getWebPSupport()).toBe(false);
  });

  it("is known at once where the browser can encode WebP", async () => {
    browser({ canvasWebP: true });
    const { detectWebPSupport, getWebPSupport } = await load();
    void detectWebPSupport();
    expect(getWebPSupport()).toBe(true);
  });

  it("only starts checking when asked, not when read", async () => {
    browser({ canvasWebP: true });
    const { getWebPSupport, subscribeWebPSupport } = await load();
    expect(getWebPSupport()).toBeNull();
    subscribeWebPSupport(() => {});
    expect(getWebPSupport()).toBe(true);
  });

  it("decodes a sample where it can't encode, as Safari can't", async () => {
    browser({ canvasWebP: false, decodes: true });
    const { detectWebPSupport, getWebPSupport, subscribeWebPSupport } =
      await load();
    const listener = vi.fn();
    subscribeWebPSupport(listener);
    // Decoding the sample takes a moment
    expect(getWebPSupport()).toBeNull();
    await expect(detectWebPSupport()).resolves.toBe(true);
    expect(getWebPSupport()).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it("is off when the sample doesn't decode", async () => {
    browser({ canvasWebP: false, decodes: false });
    const { detectWebPSupport } = await load();
    await expect(detectWebPSupport()).resolves.toBe(false);
  });
});

describe("resolveProcessedMediaUrl", () => {
  it("asks for WebP where the browser shows it", async () => {
    browser({ canvasWebP: true });
    const { resolveProcessedMediaUrl } = await load();
    expect(
      resolveProcessedMediaUrl({
        mediaUrl: { ...NAME, host: HOST },
        size: 640,
      }),
    ).toBe(`${HOST}/media/processed/640/${NAME.mediaId}.png?format=webp`);
    expect(
      resolveProcessedMediaUrl({
        mediaUrl: { ...NAME, host: HOST },
        size: 640,
        format: "original",
      }),
    ).toBe(`${HOST}/media/processed/640/${NAME.mediaId}.png`);
  });

  it("keeps the original format elsewhere", async () => {
    browser({ canvasWebP: false, decodes: false });
    const { detectWebPSupport, resolveProcessedMediaUrl } = await load();
    await detectWebPSupport();
    expect(
      resolveProcessedMediaUrl({
        mediaUrl: { ...NAME, host: HOST },
        size: 640,
      }),
    ).toBe(`${HOST}/media/processed/640/${NAME.mediaId}.png`);
  });
});
