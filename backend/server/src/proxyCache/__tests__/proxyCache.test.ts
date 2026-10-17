// @vitest-environment node
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import type { ArtifactStore } from "../../clientPlugins/artifactStore";
import { createProxyCache } from "../index";
import { proxyCacheSources } from "../sources";

const memoryStore = () => {
  const files = new Map<string, Buffer>();
  const store: ArtifactStore = {
    put: async (key, content) => {
      files.set(key, Buffer.from(content));
    },
    getStream: async (key) => {
      const file = files.get(key);
      return file ? { stream: Readable.from([file]) } : null;
    },
  };
  return { store, files };
};

const read = async (stream: Readable) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

const okFetch = (body = "console.log(1)") =>
  vi.fn(
    async () =>
      new Response(body, {
        status: 200,
        headers: { "content-type": "text/javascript" },
      }),
  );

const SCRIPT = "/static/presentation/client/js/38405774-punch_worker_binary_core.js";
const LOADER =
  "/_/presentations/_/js/k=presentations.viewer_integrated.en_GB.-k_WX6xdIBY.es5.O/am=AAIABjA/d=0/wt=0/rs=AB6fld0y9gwLtE3yFGKkufBJ0a0gqoU2lQ/m=core";

describe("gslide source", () => {
  const { isCacheable } = proxyCacheSources.gslide!;

  it("allows versioned viewer files", () => {
    expect(isCacheable(SCRIPT)).toBe(true);
    expect(
      isCacheable("/static/presentation/client/css/1311045787-viewer_css_ltr.css"),
    ).toBe(true);
    expect(isCacheable(LOADER)).toBe(true);
  });

  it("rejects anything that isn't a fixed static file", () => {
    expect(isCacheable("/presentation/d/abc/embed")).toBe(false);
    expect(isCacheable("/picker")).toBe(false);
    expect(isCacheable("/static/presentation/client/js/../../../x.js")).toBe(
      false,
    );
    expect(isCacheable(`${SCRIPT}?v=1`)).toBe(false);
    // Unversioned loader: its contents could change.
    expect(
      isCacheable("/_/presentations/_/js/k=presentations.viewer/m=core"),
    ).toBe(false);
  });
});

describe("google fonts sources", () => {
  const files = proxyCacheSources.gfonts!;
  const css = proxyCacheSources["gfonts-css"]!;

  it("allows versioned font files only", () => {
    expect(
      files.isCacheable("/s/roboto/v48/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbVmUiA8.ttf"),
    ).toBe(true);
    expect(files.isCacheable("/s/googlesans/v29/4UaGrENHsxJlGDuGo1OIlL3Owp4.woff2")).toBe(true);
    expect(files.isCacheable("/s/roboto/latest/x.woff2")).toBe(false);
    expect(files.isCacheable("/s/roboto/v48/x.woff2?evil=1")).toBe(false);
    expect(files.isCacheable("/s/roboto/v48/../../x.woff2")).toBe(false);
  });

  it("allows stylesheets", () => {
    expect(css.isCacheable("/css?family=Roboto%3A400")).toBe(true);
    expect(css.isCacheable("/css?family=Google+Sans:400,500,700")).toBe(true);
    expect(css.isCacheable("/css2?family=Roboto:wght@400;700&display=swap")).toBe(true);
    expect(css.isCacheable("/icon?family=Material+Icons")).toBe(false);
    expect(css.isCacheable("/css?family=Roboto|Lato")).toBe(true);
    expect(css.isCacheable("/css")).toBe(false);
  });

  it("points stylesheet font files at the cache", async () => {
    const { store } = memoryStore();
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          "@font-face{src:url(https://fonts.gstatic.com/s/roboto/v48/a.woff2)}" +
            "@font-face{src:url(//fonts.gstatic.com/s/roboto/v48/b.woff2)}",
          { status: 200, headers: { "content-type": "text/css" } },
        ),
    );
    const cache = createProxyCache({ store, sources: proxyCacheSources, fetchImpl });

    const file = await cache.get("gfonts-css", "/css?family=Roboto%3A400");
    expect(await read(file!.stream)).toBe(
      "@font-face{src:url(/proxy-cache/gfonts/s/roboto/v48/a.woff2)}" +
        "@font-face{src:url(/proxy-cache/gfonts/s/roboto/v48/b.woff2)}",
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://fonts.googleapis.com/css?family=Roboto%3A400",
      expect.objectContaining({
        headers: expect.objectContaining({ "user-agent": expect.stringContaining("Chrome") }),
      }),
    );
  });
});

describe("gslide stylesheets", () => {
  const body = "@import url(https://fonts.googleapis.com/css?family=Google+Sans);";

  it("point their font imports at the cache", () => {
    const out = proxyCacheSources.gslide!.transform!(Buffer.from(body), "text/css");
    expect(out.toString()).toBe(
      "@import url(/proxy-cache/gfonts-css/css?family=Google+Sans);",
    );
  });

  it("leave scripts untouched", () => {
    const out = proxyCacheSources.gslide!.transform!(
      Buffer.from(body),
      "text/javascript; charset=UTF-8",
    );
    expect(out.toString()).toBe(body);
  });
});

describe("createProxyCache", () => {
  it("fetches once, then serves from storage without the network", async () => {
    const { store } = memoryStore();
    const fetchImpl = okFetch();
    const cache = createProxyCache({
      store,
      sources: proxyCacheSources,
      fetchImpl,
    });

    const first = await cache.get("gslide", SCRIPT);
    expect(first?.hit).toBe(false);
    expect(await read(first!.stream)).toBe("console.log(1)");
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://docs.google.com${SCRIPT}`,
      expect.anything(),
    );

    fetchImpl.mockRejectedValue(new Error("offline"));
    const second = await cache.get("gslide", SCRIPT);
    expect(second?.hit).toBe(true);
    expect(second?.contentType).toBe("text/javascript");
    expect(await read(second!.stream)).toBe("console.log(1)");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("shares one upstream fetch between concurrent misses", async () => {
    const { store } = memoryStore();
    const fetchImpl = okFetch();
    const cache = createProxyCache({
      store,
      sources: proxyCacheSources,
      fetchImpl,
    });

    await Promise.all([
      cache.get("gslide", LOADER),
      cache.get("gslide", LOADER),
      cache.get("gslide", LOADER),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns null for unknown sources and disallowed paths", async () => {
    const { store } = memoryStore();
    const fetchImpl = okFetch();
    const cache = createProxyCache({
      store,
      sources: proxyCacheSources,
      fetchImpl,
    });

    expect(await cache.get("nope", SCRIPT)).toBeNull();
    expect(await cache.get("toString", SCRIPT)).toBeNull();
    expect(await cache.get("gslide", "/presentation/d/abc/embed")).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("stores nothing when the upstream doesn't return the file", async () => {
    const { store, files } = memoryStore();
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    const cache = createProxyCache({
      store,
      sources: proxyCacheSources,
      fetchImpl,
    });

    await expect(cache.get("gslide", SCRIPT)).rejects.toThrow("404");
    expect(files.size).toBe(0);

    // A later attempt tries the upstream again.
    fetchImpl.mockImplementation(okFetch());
    expect((await cache.get("gslide", SCRIPT))?.hit).toBe(false);
  });
});
