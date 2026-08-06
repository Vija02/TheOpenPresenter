import { EventEmitter } from "events";
import { describe, expect, it, vi } from "vitest";

import { createSseRoute } from "../sseRoute";

/* -------------------------------------------------------------------------- */

/** A Readable-enough request object. */
class FakeReq extends EventEmitter {
  constructor(
    public method = "POST",
    public user: unknown = { id: "u1" },
  ) {
    super();
  }
  destroy = vi.fn();
}

/** A Writable-enough response object that records what was written. */
class FakeRes extends EventEmitter {
  statusCode: number | null = null;
  headers: Record<string, string> = {};
  chunks: string[] = [];
  writableEnded = false;
  headersSent = false;

  sendStatus = vi.fn((code: number) => {
    this.statusCode = code;
    this.writableEnded = true;
    return this;
  });

  writeHead = vi.fn((code: number, headers: Record<string, string>) => {
    this.statusCode = code;
    this.headers = headers;
    this.headersSent = true;
    return this;
  });

  flushHeaders = vi.fn();

  write = vi.fn((chunk: string) => {
    this.chunks.push(chunk);
    return true;
  });

  end = vi.fn(() => {
    this.writableEnded = true;
    this.emit("close");
    return this;
  });

  /** The parsed payload of every data frame written. */
  get events(): unknown[] {
    return this.chunks
      .filter((c) => c.startsWith("data: "))
      .map((c) => JSON.parse(c.slice(6).trim()));
  }
}

/**
 * Hand-rolled rather than zod: `parse` is deliberately just "a function that
 * throws", and this package does not depend on zod. Callers pass their own.
 */
const schema = {
  parse: (raw: unknown): { n: number } => {
    if (
      typeof raw !== "object" ||
      raw === null ||
      typeof (raw as { n?: unknown }).n !== "number"
    ) {
      throw new Error("expected { n: number }");
    }
    return raw as { n: number };
  },
};

/** Drives the handler with a body, resolving once the response has ended. */
const invoke = async (
  route: ReturnType<typeof createSseRoute>,
  body: string,
  { req = new FakeReq(), res = new FakeRes() } = {},
) => {
  const done = route(req as never, res as never, () => {});
  // The handler subscribes to 'data'/'end' before awaiting, so emit after a tick.
  await Promise.resolve();
  if (body) req.emit("data", Buffer.from(body));
  req.emit("end");
  await done;
  return { req, res };
};

type EchoOptions = Parameters<typeof createSseRoute<{ n: number }>>[0];

const echoRoute = (overrides: Partial<EchoOptions> = {}) =>
  createSseRoute<{ n: number }>({
    name: "test",
    parse: (raw) => schema.parse(raw),
    async *handler({ body }) {
      yield { type: "value", n: body.n };
    },
    ...overrides,
  });

/* -------------------------------------------------------------------------- */

describe("createSseRoute", () => {
  it("streams the handler's events", async () => {
    const { res } = await invoke(echoRoute(), JSON.stringify({ n: 42 }));
    expect(res.statusCode).toBe(200);
    expect(res.events).toEqual([{ type: "value", n: 42 }]);
    expect(res.writableEnded).toBe(true);
  });

  it("sets headers that stop proxies buffering the stream", async () => {
    const { res } = await invoke(echoRoute(), JSON.stringify({ n: 1 }));
    expect(res.headers["Content-Type"]).toMatch(/text\/event-stream/);
    // Without no-transform, compression middleware holds the whole response.
    expect(res.headers["Cache-Control"]).toMatch(/no-transform/);
    expect(res.headers["X-Accel-Buffering"]).toBe("no");
  });

  it("rejects a non-POST request", async () => {
    const req = new FakeReq("GET");
    const res = new FakeRes();
    await echoRoute()(req as never, res as never, () => {});
    expect(res.sendStatus).toHaveBeenCalledWith(405);
  });

  it("rejects an unauthenticated request", async () => {
    // registerPrivateRoute mounts a bare app.use and enforces nothing, so this
    // check is the only thing standing between the route and the public.
    // `null`, not `undefined`: the latter would trip the default parameter.
    const req = new FakeReq("POST", null);
    const res = new FakeRes();
    await echoRoute()(req as never, res as never, () => {});
    expect(res.sendStatus).toHaveBeenCalledWith(401);
  });

  it("honours a custom authorize predicate", async () => {
    const res = new FakeRes();
    const route = echoRoute({ authorize: () => false });
    await route(new FakeReq() as never, res as never, () => {});
    expect(res.sendStatus).toHaveBeenCalledWith(401);
  });

  it("rejects a body that fails validation", async () => {
    const { res } = await invoke(echoRoute(), JSON.stringify({ n: "nope" }));
    expect(res.sendStatus).toHaveBeenCalledWith(400);
    expect(res.events).toEqual([]);
  });

  it("rejects malformed JSON", async () => {
    const { res } = await invoke(echoRoute(), "{{{");
    expect(res.sendStatus).toHaveBeenCalledWith(400);
  });

  it("rejects and destroys an oversized body as it arrives", async () => {
    const req = new FakeReq();
    const res = new FakeRes();
    const route = echoRoute({ maxBodyBytes: 8 });

    const done = route(req as never, res as never, () => {});
    await Promise.resolve();
    req.emit("data", Buffer.from("x".repeat(100)));
    await done;

    expect(res.sendStatus).toHaveBeenCalledWith(413);
    // Destroyed rather than merely rejected: a client mid-upload would
    // otherwise keep sending into a socket nobody reads.
    expect(req.destroy).toHaveBeenCalled();
  });

  it("counts bytes across chunks, not per chunk", async () => {
    const req = new FakeReq();
    const res = new FakeRes();
    const route = echoRoute({ maxBodyBytes: 10 });

    const done = route(req as never, res as never, () => {});
    await Promise.resolve();
    req.emit("data", Buffer.from("xxxxxx"));
    req.emit("data", Buffer.from("xxxxxx"));
    await done;

    expect(res.sendStatus).toHaveBeenCalledWith(413);
  });

  it("reports a handler failure as a fatal event, not a dead connection", async () => {
    const route = createSseRoute({
      name: "test",
      parse: (raw) => schema.parse(raw),
      // eslint-disable-next-line require-yield
      async *handler() {
        throw new Error("model exploded");
      },
    });

    const { res } = await invoke(route, JSON.stringify({ n: 1 }));
    expect(res.events).toEqual([{ type: "fatal", message: "model exploded" }]);
    expect(res.writableEnded).toBe(true);
  });

  it("aborts the handler's signal when the client disconnects", async () => {
    let observed: AbortSignal | undefined;
    let stoppedEarly = false;

    const route = createSseRoute({
      name: "test",
      parse: (raw) => schema.parse(raw),
      async *handler({ signal }) {
        observed = signal;
        yield { step: 1 };
        // The route breaks its loop on abort, so this generator is closed here
        // rather than continuing to burn a model call.
        await new Promise((r) => setTimeout(r, 5));
        yield { step: 2 };
        stoppedEarly = true;
      },
    });

    const req = new FakeReq();
    const res = new FakeRes();
    const done = route(req as never, res as never, () => {});
    await Promise.resolve();
    req.emit("data", Buffer.from(JSON.stringify({ n: 1 })));
    req.emit("end");

    // Let the first event through, then hang up.
    await new Promise((r) => setTimeout(r, 1));
    res.emit("close");
    await done;

    expect(observed?.aborted).toBe(true);
    expect(stoppedEarly).toBe(false);
    // Only the pre-disconnect event was written.
    expect(res.events).toEqual([{ step: 1 }]);
  });

  it("does not log or report an error once the client has gone", async () => {
    const route = createSseRoute({
      name: "test",
      parse: (raw) => schema.parse(raw),
      async *handler({ signal }) {
        yield { step: 1 };
        await new Promise((r) => setTimeout(r, 5));
        if (signal.aborted) throw new Error("aborted mid-work");
        yield { step: 2 };
      },
    });

    const req = new FakeReq();
    const res = new FakeRes();
    const done = route(req as never, res as never, () => {});
    await Promise.resolve();
    req.emit("data", Buffer.from(JSON.stringify({ n: 1 })));
    req.emit("end");
    await new Promise((r) => setTimeout(r, 1));
    res.emit("close");
    await done;

    // A user closing a panel is not an incident worth a fatal frame.
    expect(
      res.events.some((e) => (e as { type?: string }).type === "fatal"),
    ).toBe(false);
  });
});
