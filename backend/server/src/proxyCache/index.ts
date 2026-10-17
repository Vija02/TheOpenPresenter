import { logger } from "@repo/observability";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { type ArtifactStore } from "../clientPlugins/artifactStore";
import { type ProxyCacheSource } from "./sources";

/**
 * Fetch an upstream file once, then serve it from our own storage forever.
 * Only proxy those in the whitelist.
 */

const PREFIX = "proxy-cache";
const FETCH_TIMEOUT_MS = 20_000;
const MAX_BYTES = 25 * 1024 * 1024;

type Meta = { url: string; contentType: string; fetchedAt: string };

export type CachedFile = {
  stream: Readable;
  contentType: string;
  hit: boolean;
};

const keyFor = (
  sourceName: string,
  source: ProxyCacheSource,
  pathAndQuery: string,
) => {
  // Hashed: loader URLs can be longer than a filename is allowed to be.
  const hash = createHash("sha256").update(pathAndQuery).digest("hex");
  const version = source.version ? `v${source.version}/` : "";
  return `${PREFIX}/${sourceName}/${version}${hash}`;
};

const readMeta = async (
  store: ArtifactStore,
  key: string,
): Promise<Meta | null> => {
  const obj = await store.getStream(`${key}.json`);
  if (!obj) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of obj.stream) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Meta;
};

const fetchUpstream = async (
  url: string,
  headers: Record<string, string> | undefined,
  fetchImpl: typeof fetch,
): Promise<{ body: Buffer; contentType: string }> => {
  const res = await fetchImpl(url, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    // A redirect would mean the path isn't the immutable file we expected.
    redirect: "error",
  });
  if (res.status !== 200) {
    throw new Error(`Upstream responded ${res.status}`);
  }
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    throw new Error(`Upstream file too large (${declared} bytes)`);
  }
  const body = Buffer.from(await res.arrayBuffer());
  if (body.byteLength > MAX_BYTES) {
    throw new Error(`Upstream file too large (${body.byteLength} bytes)`);
  }
  return {
    body,
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
  };
};

export const createProxyCache = ({
  store,
  sources,
  fetchImpl = fetch,
}: {
  store: ArtifactStore;
  sources: Record<string, ProxyCacheSource>;
  fetchImpl?: typeof fetch;
}) => {
  // Concurrent misses for the same file share one upstream fetch.
  const inFlight = new Map<string, Promise<void>>();

  const populate = (key: string, source: ProxyCacheSource, url: string) => {
    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = (async () => {
      const fetched = await fetchUpstream(url, source.headers, fetchImpl);
      const { contentType } = fetched;
      const body = source.transform
        ? source.transform(fetched.body, contentType)
        : fetched.body;
      await store.put(key, body, contentType);
      // Written last: a file only counts as cached once its meta exists.
      const meta: Meta = {
        url,
        contentType,
        fetchedAt: new Date().toISOString(),
      };
      await store.put(`${key}.json`, JSON.stringify(meta), "application/json");
      logger.info({ url, bytes: body.byteLength }, "Proxy cache stored file");
    })().finally(() => inFlight.delete(key));

    inFlight.set(key, promise);
    return promise;
  };

  /**
   * Null when the source or path isn't allowed. Throws when it's allowed but
   * not cached yet and the upstream can't be reached.
   */
  const get = async (
    sourceName: string,
    pathAndQuery: string,
  ): Promise<CachedFile | null> => {
    const source = Object.prototype.hasOwnProperty.call(sources, sourceName)
      ? sources[sourceName]
      : undefined;
    if (!source || !source.isCacheable(pathAndQuery)) return null;

    const key = keyFor(sourceName, source, pathAndQuery);

    let hit = true;
    let meta = await readMeta(store, key);
    if (!meta) {
      hit = false;
      await populate(key, source, source.upstream + pathAndQuery);
      meta = await readMeta(store, key);
    }

    const obj = meta ? await store.getStream(key) : null;
    if (!meta || !obj) {
      throw new Error(`Proxy cache lost ${key} right after storing it`);
    }
    return { stream: obj.stream, contentType: meta.contentType, hit };
  };

  return { get };
};

export type ProxyCache = ReturnType<typeof createProxyCache>;
