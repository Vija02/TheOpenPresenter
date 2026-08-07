#!/usr/bin/env node

/**
 * A fake OpenAI-compatible provider, for E2E.
 *
 * The app server talks to this instead of a real provider, so the whole AI path
 * runs for real — capability route, SSE framing, the agent loop, the layout
 * tools, the document validator — with only the model's own output faked. That
 * is the one part of the chain with no deterministic behaviour to assert on.
 *
 * Two surfaces, both plain HTTP on the same port:
 *
 *   POST /v1/chat/completions   what the app server calls
 *   POST /__control/script      a test declares what the model will do
 *   GET  /__control/requests    what the app server actually sent
 *   GET  /__control/health      liveness + a sentinel the app can echo back
 *
 * Scripts are matched on a substring of the user's request text, so tests
 * running in parallel workers cannot pick up each other's scripts. Each script
 * holds one reply per agent turn, consumed in order.
 */
import { type IncomingMessage, type ServerResponse, createServer } from "http";

const PORT = Number(process.env.FAKE_AI_PORT || 5679);

/* -------------------------------------------------------------------------- */
/* Wire types                                                                 */
/* -------------------------------------------------------------------------- */

type ToolCall = { name: string; arguments: unknown };

/** One assistant turn. Tool calls and prose are both optional. */
export type FakeTurn = {
  /** Streamed as `reasoning` deltas, in chunks, before anything else. */
  reasoning?: string;
  /** Streamed as `content` deltas, in chunks. */
  content?: string;
  toolCalls?: ToolCall[];
  /** Defaults to "tool_calls" when there are tool calls, else "stop". */
  finishReason?: string;
  /** Fails the request with this HTTP status instead of replying. */
  errorStatus?: number;
  /** A 200 that streams an error mid-body, as OpenRouter does. */
  streamError?: string;
  /** Holds the response open this long before the first byte. */
  delayMs?: number;
  /** Streams the deltas, then never sends `[DONE]`, leaving the stream hanging. */
  hang?: boolean;
};

export type FakeScript = {
  /** Matched against the user's request text. */
  match: string;
  turns: FakeTurn[];
};

type RecordedRequest = {
  model: string;
  messages: unknown[];
  tools: string[];
  toolChoice: unknown;
  reasoning: unknown;
  /** The request text of the last user message, image parts excluded. */
  userText: string;
  /** True when the last user message carried an image part. */
  hasImage: boolean;
  authorization: string;
  receivedAt: number;
};

/* -------------------------------------------------------------------------- */
/* State                                                                      */
/* -------------------------------------------------------------------------- */

const scripts: FakeScript[] = [];
/** Turns already served, per script, so each turn is used once. */
const cursors = new Map<FakeScript, number>();
const requests: RecordedRequest[] = [];

/** Proof that the app server is talking to THIS process. */
const SENTINEL = `fake-ai-${process.pid}-${Date.now().toString(36)}`;

/* -------------------------------------------------------------------------- */
/* Request parsing                                                            */
/* -------------------------------------------------------------------------- */

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

type WireUserContent =
  | string
  | Array<{ type: string; text?: string; image_url?: { url: string } }>;

/** The text and any image out of the final user message. */
const describeUserMessage = (
  messages: Array<{ role?: string; content?: WireUserContent }>,
): { userText: string; hasImage: boolean } => {
  const last = [...messages].reverse().find((m) => m.role === "user");
  const content = last?.content;

  if (typeof content === "string")
    return { userText: content, hasImage: false };
  if (!Array.isArray(content)) return { userText: "", hasImage: false };

  return {
    userText: content
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n"),
    hasImage: content.some((part) => part.type === "image_url"),
  };
};

/* -------------------------------------------------------------------------- */
/* Response construction                                                      */
/* -------------------------------------------------------------------------- */

const CHUNK = 12;

/** Split so streaming is exercised as streaming, not one big delta. */
const chunked = (text: string): string[] => {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK) {
    parts.push(text.slice(i, i + CHUNK));
  }
  return parts;
};

const dataFrame = (payload: unknown): string =>
  `data: ${JSON.stringify(payload)}\n\n`;

const deltaFrame = (delta: unknown, finishReason: string | null = null) =>
  dataFrame({
    id: "chatcmpl-fake",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "fake-model",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Streams one turn in the OpenAI SSE shape.
 *
 * Tool call arguments are deliberately split across two frames: the accumulator
 * in client.ts reassembles fragments, and a fake that only ever sent whole
 * arguments would never exercise that.
 */
const streamTurn = async (
  res: ServerResponse,
  turn: FakeTurn,
): Promise<void> => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  if (turn.streamError) {
    res.write(dataFrame({ error: { message: turn.streamError } }));
    res.end();
    return;
  }

  for (const delta of chunked(turn.reasoning ?? "")) {
    res.write(deltaFrame({ reasoning: delta }));
    await sleep(5);
  }

  for (const delta of chunked(turn.content ?? "")) {
    res.write(deltaFrame({ content: delta }));
    await sleep(5);
  }

  const calls = turn.toolCalls ?? [];
  for (const [index, call] of calls.entries()) {
    const args = JSON.stringify(call.arguments ?? {});
    const split = Math.ceil(args.length / 2);

    res.write(
      deltaFrame({
        tool_calls: [
          {
            index,
            id: `call_fake_${index}`,
            type: "function",
            function: { name: call.name, arguments: args.slice(0, split) },
          },
        ],
      }),
    );
    await sleep(5);
    res.write(
      deltaFrame({
        tool_calls: [{ index, function: { arguments: args.slice(split) } }],
      }),
    );
    await sleep(5);
  }

  const finishReason =
    turn.finishReason ?? (calls.length > 0 ? "tool_calls" : "stop");
  res.write(deltaFrame({}, finishReason));

  res.write(
    dataFrame({
      id: "chatcmpl-fake",
      object: "chat.completion.chunk",
      model: "fake-model",
      choices: [],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    }),
  );

  // Left hanging on purpose: the client's idle timeout is the thing under test.
  if (turn.hang) return;

  res.write("data: [DONE]\n\n");
  res.end();
};

/* -------------------------------------------------------------------------- */
/* Handlers                                                                   */
/* -------------------------------------------------------------------------- */

const json = (res: ServerResponse, status: number, payload: unknown) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
};

const handleChatCompletion = async (
  req: IncomingMessage,
  res: ServerResponse,
) => {
  const raw = await readBody(req);
  let body: {
    model?: string;
    messages?: Array<{ role?: string; content?: WireUserContent }>;
    tools?: Array<{ function?: { name?: string } }>;
    tool_choice?: unknown;
    reasoning?: unknown;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    json(res, 400, { error: { message: "invalid JSON" } });
    return;
  }

  const messages = body.messages ?? [];
  const { userText, hasImage } = describeUserMessage(messages);

  requests.push({
    model: body.model ?? "",
    messages,
    tools: (body.tools ?? []).map((t) => t.function?.name ?? ""),
    toolChoice: body.tool_choice,
    reasoning: body.reasoning,
    userText,
    hasImage,
    authorization: String(req.headers.authorization ?? ""),
    receivedAt: Date.now(),
  });

  const script = scripts.find((s) => userText.includes(s.match));
  if (!script) {
    // Loud rather than a plausible-looking default: a test whose script did not
    // match should fail on that, not on a mystery assertion later.
    json(res, 400, {
      error: {
        message: `fake-ai: no script matched. userText=${JSON.stringify(
          userText.slice(0, 200),
        )} scripts=${JSON.stringify(scripts.map((s) => s.match))}`,
      },
    });
    return;
  }

  const cursor = cursors.get(script) ?? 0;
  const turn = script.turns[cursor];
  cursors.set(script, cursor + 1);

  if (!turn) {
    json(res, 400, {
      error: {
        message: `fake-ai: script "${script.match}" ran out of turns after ${cursor}. The agent looped more than expected.`,
      },
    });
    return;
  }

  if (turn.delayMs) await sleep(turn.delayMs);

  if (turn.errorStatus) {
    json(res, turn.errorStatus, {
      error: { message: `fake-ai: scripted ${turn.errorStatus}` },
    });
    return;
  }

  await streamTurn(res, turn);
};

const handleControl = async (
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
) => {
  if (path === "/__control/health") {
    json(res, 200, { ok: true, sentinel: SENTINEL, port: PORT });
    return;
  }

  if (path === "/__control/script" && req.method === "POST") {
    const script = JSON.parse(await readBody(req)) as FakeScript;
    if (!script?.match || !Array.isArray(script.turns)) {
      json(res, 400, { error: "script needs { match, turns[] }" });
      return;
    }
    // Newest first, so a re-registered match supersedes the old one.
    scripts.unshift(script);
    json(res, 200, { ok: true });
    return;
  }

  if (path === "/__control/requests" && req.method === "GET") {
    json(res, 200, { requests });
    return;
  }

  if (path === "/__control/reset" && req.method === "POST") {
    const { match } = JSON.parse((await readBody(req)) || "{}") as {
      match?: string;
    };
    // Scoped by default: a worker resetting everything would pull scripts out
    // from under the other workers mid-run.
    for (let i = scripts.length - 1; i >= 0; i--) {
      if (match === undefined || scripts[i]!.match === match) {
        cursors.delete(scripts[i]!);
        scripts.splice(i, 1);
      }
    }
    if (match === undefined) requests.length = 0;
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { error: "unknown control endpoint" });
};

/* -------------------------------------------------------------------------- */
/* Server                                                                     */
/* -------------------------------------------------------------------------- */

const server = createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0]!;

  const done = (async () => {
    if (path.startsWith("/__control/")) return handleControl(req, res, path);
    // Matches however the base URL was configured, with or without /v1.
    if (path.endsWith("/chat/completions") && req.method === "POST") {
      return handleChatCompletion(req, res);
    }
    json(res, 404, { error: `fake-ai: no route for ${req.method} ${path}` });
  })();

  done.catch((err) => {
    // The socket may already be committed to a stream, in which case all that
    // can be done is drop it.
    if (!res.headersSent) json(res, 500, { error: String(err) });
    else res.destroy();
  });
});

server.listen(PORT, () => {
  console.log(`fake-ai listening on http://localhost:${PORT}`);
  console.log(`fake-ai sentinel ${SENTINEL}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
