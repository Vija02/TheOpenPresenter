/**
 * Server-Sent Events framing.
 * Follows the WHATWG event stream spec
 */

/** A dispatched event. `event` is "message" unless the stream named it. */
export type SseEvent = {
  event: string;
  data: string;
  id: string | null;
};

export const SSE_RESPONSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // nginx-specific, ignored elsewhere, same purpose as no-transform.
  "X-Accel-Buffering": "no",
} as const;

/** Serialises one JSON payload as a frame, trailing blank line included. */
export const sseFrame = (data: unknown, event?: string): string =>
  `${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(data)}\n\n`;

/** A comment frame. Keeps idle connections alive through proxies. */
export const sseComment = (text = "ping"): string => `: ${text}\n\n`;

const FIELD = /^([^:]*)(?::[ ]?)?([\s\S]*)$/;

/**
 * Incremental decoder. Feed it decoded text; it returns whichever events became complete
 */
export class SseDecoder {
  private buffer = "";
  private data: string[] = [];
  private event = "";
  private id: string | null = null;
  private atStart = true;

  push(chunk: string): SseEvent[] {
    if (this.atStart) {
      this.atStart = false;
      if (chunk.startsWith("\uFEFF")) chunk = chunk.slice(1);
    }
    this.buffer += chunk;

    const events: SseEvent[] = [];
    for (;;) {
      const line = this.takeLine();
      if (line === null) break;
      const event = this.consumeLine(line);
      if (event) events.push(event);
    }
    return events;
  }

  flush(): SseEvent[] {
    const events: SseEvent[] = [];
    if (this.buffer.length > 0) {
      const rest = this.buffer;
      this.buffer = "";
      const event = this.consumeLine(rest);
      if (event) events.push(event);
    }
    const trailing = this.dispatch();
    if (trailing) events.push(trailing);
    return events;
  }

  /** The next complete line, or null when the buffer holds only a partial one. */
  private takeLine(): string | null {
    const lf = this.buffer.indexOf("\n");
    const cr = this.buffer.indexOf("\r");

    if (cr !== -1 && (lf === -1 || cr < lf)) {
      // A CR at the very end may be the first half of a CRLF, so it is not yet
      // known to be a line ending. Wait for the next chunk.
      if (cr === this.buffer.length - 1) return null;
      const line = this.buffer.slice(0, cr);
      const skip = this.buffer[cr + 1] === "\n" ? 2 : 1;
      this.buffer = this.buffer.slice(cr + skip);
      return line;
    }

    if (lf === -1) return null;
    const line = this.buffer.slice(0, lf);
    this.buffer = this.buffer.slice(lf + 1);
    return line;
  }

  private consumeLine(line: string): SseEvent | null {
    if (line === "") return this.dispatch();
    if (line.startsWith(":")) return null;

    const match = FIELD.exec(line);
    if (!match) return null;
    const [, field = "", value = ""] = match;

    switch (field) {
      case "data":
        this.data.push(value);
        break;
      case "event":
        this.event = value;
        break;
      case "id":
        // NULs are rejected by the spec; retry/unknown fields are ignored.
        if (!value.includes("\0")) this.id = value;
        break;
    }
    return null;
  }

  private dispatch(): SseEvent | null {
    if (this.data.length === 0) {
      this.event = "";
      return null;
    }
    const event: SseEvent = {
      event: this.event || "message",
      data: this.data.join("\n"),
      id: this.id,
    };
    this.data = [];
    this.event = "";
    return event;
  }
}

export type ReadSseOptions = {
  onActivity?: () => void;
  signal?: AbortSignal;
};

/** Rejects when the signal aborts. Never resolves. */
const abortPromise = (signal: AbortSignal): Promise<never> =>
  new Promise((_, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });

/**
 * Reads a `fetch` body as a stream of events.
 */
export async function* readSseEvents(
  body: ReadableStream<Uint8Array>,
  options: ReadSseOptions = {},
): AsyncGenerator<SseEvent, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const sse = new SseDecoder();
  const { signal } = options;
  // Built once, not per read: a listener added on every iteration would leak on
  // a long stream and eventually trip Node's max-listeners warning.
  const aborted = signal ? abortPromise(signal) : null;

  try {
    for (;;) {
      const { done, value } = aborted
        ? await Promise.race([reader.read(), aborted])
        : await reader.read();
      if (done) break;
      options.onActivity?.();
      yield* sse.push(decoder.decode(value, { stream: true }));
    }
    // Flushes both decoders: a truncated multi-byte character and an
    // unterminated frame are the same class of problem.
    yield* sse.push(decoder.decode());
    yield* sse.flush();
  } finally {
    // Already-closed readers reject here; there is nothing useful to do about
    // it, and letting it propagate would mask whatever ended the loop.
    await reader.cancel().catch(() => {});
  }
}
