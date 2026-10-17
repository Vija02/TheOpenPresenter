import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { createMediaHandler } from "../src/media/factory";
import type { OurDataStore } from "../src/media/OurDataStore";
import type { WithPgClient } from "../src/types";

const CONTENT = Buffer.alloc(64 * 1024, "a");

/** A store whose first write reads part of the stream then fails, like B2's 500s */
const flakyStore = (failures: number) => {
  const received: number[] = [];
  let attempts = 0;
  const store = {
    create: vi.fn(async (upload) => upload),
    write: vi.fn(async (src: Readable) => {
      attempts++;
      if (attempts <= failures) {
        // Read a little, then fail mid-upload
        await new Promise((resolve) => src.once("readable", resolve));
        src.read(1024);
        throw Object.assign(new Error("internal incident"), {
          Code: "InternalError",
        });
      }
      let bytes = 0;
      for await (const chunk of src) bytes += chunk.length;
      received.push(bytes);
      return bytes;
    }),
  };
  return { store: store as unknown as OurDataStore, received, store_: store };
};

const withPgClient: WithPgClient = (cb) =>
  cb({ query: vi.fn(async () => ({ rows: [] })) } as any);

const upload = (store: OurDataStore, file: Readable | (() => Readable)) => {
  const Handler = createMediaHandler(() => store);
  return new Handler(withPgClient).uploadMedia({
    file,
    fileExtension: "pdf",
    fileSize: CONTENT.length,
    userId: null,
    organizationId: "org",
    skipProcessing: true,
  });
};

describe("uploadMedia retries", () => {
  it("retries with a fresh stream, so the whole file is uploaded", async () => {
    const { store, received, store_ } = flakyStore(2);

    await upload(store, () => Readable.from([CONTENT]));

    expect(store_.write).toHaveBeenCalledTimes(3);
    expect(received).toEqual([CONTENT.length]);
  });

  it("doesn't retry a plain stream, since a retry would upload what's left of it", async () => {
    const { store, store_ } = flakyStore(1);

    await expect(upload(store, Readable.from([CONTENT]))).rejects.toThrow(
      "internal incident",
    );
    expect(store_.write).toHaveBeenCalledTimes(1);
  });
});
