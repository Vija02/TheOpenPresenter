import { extractMediaName } from "@repo/lib";
import { Readable, Transform } from "stream";
import type { ReadableStream as WebReadableStream } from "stream/web";

import type { MediaHandlerInterface } from "../../../media/types";
import type { CloudMedia } from "./cloud";

/** The cloud's media files, as they move between the two stores. */

const TUS_VERSION = "1.0.0";
// Under common proxy body limits, and few enough requests for large videos.
const UPLOAD_CHUNK_BYTES = 32 * 1024 * 1024;

export type LocalMedia = {
  id: string;
  media_name: string;
  file_size: string | null;
  original_name: string | null;
  is_user_uploaded: boolean;
};

const counting = (onBytes: (n: number) => void) =>
  new Transform({
    transform(chunk: Buffer, _enc, cb) {
      onBytes(chunk.length);
      cb(null, chunk);
    },
  });

/** Copy a cloud media file into the local store, under the same id. */
export const downloadMedia = async ({
  host,
  media,
  mediaHandler,
  organizationId,
  userId,
  onBytes,
}: {
  host: string;
  media: CloudMedia;
  mediaHandler: MediaHandlerInterface;
  organizationId: string;
  userId: string | null;
  onBytes: (n: number) => void;
}): Promise<void> => {
  const res = await fetch(new URL(`/media/data/${media.mediaName}`, host));
  if (!res.ok || !res.body) {
    throw new Error(`Downloading ${media.mediaName} failed: ${res.status}`);
  }
  const { mediaId, extension } = extractMediaName(media.mediaName);
  await mediaHandler.uploadMedia({
    file: Readable.fromWeb(res.body as WebReadableStream).pipe(
      counting(onBytes),
    ),
    fileExtension: extension,
    fileSize: Number(media.fileSize ?? 0),
    userId,
    organizationId,
    mediaId,
    originalFileName: media.originalName ?? undefined,
    isUserUploaded: media.isUserUploaded,
    // Derived media come with the metadata; never derive them twice.
    skipProcessing: true,
  });
};

/**
 * Upload a local media file to the cloud's tus endpoint under the same id.
 * The media name decides the upload URL, so asking it first tells whether
 * the cloud already has the file (a lost response last time) or how much of
 * it (an interrupted upload), and only the rest is sent.
 */
export const uploadMedia = async ({
  host,
  sessionCookie,
  cloudOrganizationId,
  media,
  read,
  onBytes,
}: {
  host: string;
  sessionCookie: string;
  cloudOrganizationId: string;
  media: LocalMedia;
  read: () => Promise<Readable>;
  onBytes: (n: number) => void;
}): Promise<void> => {
  const endpoint = new URL("/media/upload/tus", host).toString();
  const url = `${endpoint}/${media.media_name}`;
  const size = Number(media.file_size ?? 0);
  const { mediaId, extension } = extractMediaName(media.media_name);
  const headers = {
    "Tus-Resumable": TUS_VERSION,
    Cookie: sessionCookie,
    Origin: host,
    "organization-id": cloudOrganizationId,
    "custom-media-id": mediaId,
    "file-extension": extension,
    // Keep it as it is here: no reprocessing, and the same kind of media.
    "cloud-sync": "1",
    "cloud-sync-user-uploaded": media.is_user_uploaded ? "1" : "0",
  };

  let offset = 0;
  const head = await fetch(url, { method: "HEAD", headers });
  if (head.ok) {
    offset = Number(head.headers.get("upload-offset") ?? 0);
  } else if (head.status === 404 || head.status === 410) {
    const filename = Buffer.from(media.original_name ?? "").toString("base64");
    const created = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...headers,
        "Upload-Length": String(size),
        "Upload-Metadata": `filename ${filename}`,
      },
    });
    if (created.status !== 201) {
      throw new Error(
        `Creating upload ${media.media_name} failed: ${created.status} ${await created.text()}`,
      );
    }
  } else {
    throw new Error(
      `Checking upload ${media.media_name} failed: ${head.status}`,
    );
  }
  if (offset >= size) return;

  for await (const chunk of chunksFrom(await read(), offset)) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        ...headers,
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
      },
      body: chunk,
    });
    if (res.status !== 204) {
      throw new Error(
        `Uploading ${media.media_name} failed at ${offset}: ${res.status} ${await res.text()}`,
      );
    }
    offset = Number(res.headers.get("upload-offset"));
    onBytes(chunk.length);
  }
  if (offset !== size) {
    throw new Error(
      `Uploading ${media.media_name} stopped at ${offset} of ${size} bytes`,
    );
  }
};

/** The stream from `start`, in chunks of at most UPLOAD_CHUNK_BYTES. */
async function* chunksFrom(stream: Readable, start: number) {
  let skip = start;
  let pending: Buffer[] = [];
  let pendingBytes = 0;
  for await (const data of stream) {
    let buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (skip > 0) {
      const skipped = Math.min(skip, buffer.length);
      buffer = buffer.subarray(skipped);
      skip -= skipped;
    }
    while (buffer.length > 0) {
      const take = Math.min(UPLOAD_CHUNK_BYTES - pendingBytes, buffer.length);
      pending.push(buffer.subarray(0, take));
      pendingBytes += take;
      buffer = buffer.subarray(take);
      if (pendingBytes === UPLOAD_CHUNK_BYTES) {
        yield Buffer.concat(pending);
        pending = [];
        pendingBytes = 0;
      }
    }
  }
  if (pendingBytes > 0) yield Buffer.concat(pending);
}
