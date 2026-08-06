import { SSE_RESPONSE_HEADERS, sseComment, sseFrame } from "@repo/lib";
import { logger } from "@repo/observability";
import { RequestHandler } from "express";

/**
 * SSE route helper for AI uses
 */

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const KEEPALIVE_MS = 15_000;

export type SseHandlerContext<T> = {
  body: T;
  signal: AbortSignal;
  readonly closed: boolean;
};

export type SseRouteOptions<T> = {
  name: string;
  parse: (raw: unknown) => T;
  handler: (
    context: SseHandlerContext<T>,
  ) => AsyncGenerator<unknown, void, unknown>;
  maxBodyBytes?: number;
  /** Defaults to requiring `req.user` */
  authorize?: (req: Parameters<RequestHandler>[0]) => boolean;
};

const readBody = (
  req: Parameters<RequestHandler>[0],
  limit: number,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const fail = (status: number, message: string) => {
      if (settled) return;
      settled = true;
      reject(Object.assign(new Error(message), { status }));
    };

    req.on("data", (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        // Destroying rather than just rejecting: a client mid-upload will
        // otherwise keep sending into a socket nobody is reading.
        req.destroy();
        fail(413, "Request body too large");
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", (err) => fail(400, err.message));
    req.on("aborted", () => fail(400, "Request aborted"));
  });

export const createSseRoute = <T>({
  name,
  parse,
  handler,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  authorize = (req) => !!(req as { user?: unknown }).user,
}: SseRouteOptions<T>): RequestHandler => {
  return async (req, res) => {
    if (req.method !== "POST") {
      res.sendStatus(405);
      return;
    }
    if (!authorize(req)) {
      res.sendStatus(401);
      return;
    }

    let body: T;
    try {
      const raw = await readBody(req, maxBodyBytes);
      body = parse(JSON.parse(raw || "{}"));
    } catch (err) {
      const status = (err as { status?: number }).status ?? 400;
      if (!res.headersSent) res.sendStatus(status);
      return;
    }

    const controller = new AbortController();
    res.on("close", () => controller.abort());

    res.writeHead(200, SSE_RESPONSE_HEADERS);
    res.flushHeaders?.();

    const keepalive = setInterval(() => {
      if (!res.writableEnded) res.write(sseComment());
    }, KEEPALIVE_MS);

    const context: SseHandlerContext<T> = {
      body,
      signal: controller.signal,
      get closed() {
        return controller.signal.aborted;
      },
    };

    try {
      for await (const event of handler(context)) {
        if (controller.signal.aborted || res.writableEnded) break;
        res.write(sseFrame(event));
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        logger.error({ err, route: name }, "SSE route failed");
        if (!res.writableEnded) {
          res.write(
            sseFrame({
              type: "fatal",
              message: (err as Error)?.message || "The request failed",
            }),
          );
        }
      }
    } finally {
      clearInterval(keepalive);
      if (!res.writableEnded) res.end();
    }
  };
};
