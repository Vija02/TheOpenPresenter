import { Readable } from "node:stream";

export function streamToBuffer(stream: Readable) {
  return new Promise<Buffer>((resolve, reject) => {
    const _buf: Uint8Array<ArrayBufferLike>[] = [];

    stream.on("data", (chunk) => _buf.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(_buf)));
    stream.on("error", (err) => reject(err));
  });
}
