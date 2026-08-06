import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  chatCompletion,
  chatCompletionEvents,
  chatCompletionMessage,
  chatCompletionStream,
} from "../client";
import { AIRequestError, ChatStreamEvent } from "../types";

/* -------------------------------------------------------------------------- */

const encoder = new TextEncoder();

/** A streamed response body built from SSE frame bodies. */
const sseBody = (frames: string[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(`data: ${frame}\n\n`));
      }
      controller.close();
    },
  });

const chunk = (delta: unknown, finishReason?: string) =>
  JSON.stringify({
    choices: [
      { delta, ...(finishReason ? { finish_reason: finishReason } : {}) },
    ],
  });

const okStream = (frames: string[]) =>
  new Response(sseBody(frames), { status: 200 });

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const drain = async (
  events: AsyncGenerator<ChatStreamEvent, void, unknown>,
): Promise<ChatStreamEvent[]> => {
  const seen: ChatStreamEvent[] = [];
  for await (const event of events) seen.push(event);
  return seen;
};

/** `Array.prototype.at` is unavailable: this package targets ES2018. */
const last = <T>(items: T[]): T | undefined => items[items.length - 1];

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.AI_API_KEY = "test-key";
  process.env.AI_BASE_URL = "https://example.invalid/v1";
  process.env.AI_MODEL = "test-model";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AI_API_KEY;
  delete process.env.AI_BASE_URL;
  delete process.env.AI_MODEL;
});

const MESSAGES = [{ role: "user" as const, content: "hi" }];

/** The parsed body of the nth fetch call. */
const sentBody = (n = 0) => JSON.parse(fetchMock.mock.calls[n]![1].body);

/* -------------------------------------------------------------------------- */

describe("chatCompletionEvents", () => {
  it("streams content deltas and assembles the final message", async () => {
    fetchMock.mockResolvedValue(
      okStream([
        chunk({ content: "Hel" }),
        chunk({ content: "lo" }),
        chunk({}, "stop"),
        "[DONE]",
      ]),
    );

    const events = await drain(chatCompletionEvents(MESSAGES));
    expect(events.filter((e) => e.type === "content")).toEqual([
      { type: "content", delta: "Hel" },
      { type: "content", delta: "lo" },
    ]);

    const done = last(events);
    expect(done).toMatchObject({
      type: "done",
      message: { content: "Hello", finishReason: "stop", truncated: false },
    });
  });

  it("reports reasoning separately from content", async () => {
    fetchMock.mockResolvedValue(
      okStream([
        chunk({ reasoning: "thinking" }),
        chunk({ content: "answer" }, "stop"),
      ]),
    );

    const events = await drain(chatCompletionEvents(MESSAGES));
    expect(events).toContainEqual({ type: "reasoning", delta: "thinking" });
    const done = last(events);
    expect(done).toMatchObject({
      message: { content: "answer", reasoning: "thinking" },
    });
  });

  it("reads reasoning_content, which is what DeepSeek-style providers send", async () => {
    fetchMock.mockResolvedValue(
      okStream([chunk({ reasoning_content: "hmm" }), chunk({}, "stop")]),
    );
    const events = await drain(chatCompletionEvents(MESSAGES));
    expect(events).toContainEqual({ type: "reasoning", delta: "hmm" });
  });

  it("assembles a tool call whose arguments arrive in fragments", async () => {
    fetchMock.mockResolvedValue(
      okStream([
        chunk({
          tool_calls: [
            {
              index: 0,
              id: "c1",
              function: { name: "set_fill", arguments: "" },
            },
          ],
        }),
        chunk({
          tool_calls: [{ index: 0, function: { arguments: '{"id":' } }],
        }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: '"a"}' } }] }),
        chunk({}, "tool_calls"),
      ]),
    );

    const events = await drain(chatCompletionEvents(MESSAGES));

    // The name is announced on the first fragment, long before the arguments
    // finish — that early signal is the whole point of streaming tool calls.
    const first = events.find((e) => e.type === "toolCall");
    expect(first).toMatchObject({ name: "set_fill", started: true });

    expect(
      (last(events) as { message: { toolCalls: unknown[] } }).message,
    ).toMatchObject({
      toolCalls: [
        {
          id: "c1",
          type: "function",
          function: { name: "set_fill", arguments: '{"id":"a"}' },
        },
      ],
    });
  });

  it("sends '{}' for a no-argument tool call, not an empty string", async () => {
    // A tool with an empty schema streams a name and no argument fragments. The
    // raw "" then travels back to the provider inside the assistant message the
    // caller echoes, and OpenRouter rejects it on the next turn with
    // "tool_use.input: Input should be an object" — a failure that only shows up
    // on turn two, after turn one appeared to work.
    fetchMock.mockResolvedValue(
      okStream([
        chunk({
          tool_calls: [
            { index: 0, id: "c0", function: { name: "list_elements" } },
          ],
        }),
        chunk({}, "tool_calls"),
      ]),
    );

    const done = last(await drain(chatCompletionEvents(MESSAGES))) as {
      message: { toolCalls: Array<{ function: { arguments: string } }> };
    };
    expect(done.message.toolCalls[0]!.function.arguments).toBe("{}");
    expect(JSON.parse(done.message.toolCalls[0]!.function.arguments)).toEqual(
      {},
    );
  });

  it("normalises empty arguments on the non-streaming path too", async () => {
    fetchMock.mockResolvedValue(
      okJson({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "c0",
                  type: "function",
                  function: { name: "list_elements", arguments: "" },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      }),
    );

    const message = await chatCompletionMessage(MESSAGES, { stream: false });
    expect(message.toolCalls[0]!.function.arguments).toBe("{}");
  });

  it("produces an assistant turn the provider accepts when echoed back", async () => {
    // End to end on the actual regression: turn one calls a no-argument tool,
    // turn two echoes that assistant message back. The arguments string is what
    // becomes `tool_use.input` upstream, so it has to parse as an object.
    fetchMock
      .mockResolvedValueOnce(
        okStream([
          chunk({
            tool_calls: [
              { index: 0, id: "c0", function: { name: "list_elements" } },
            ],
          }),
          chunk({}, "tool_calls"),
        ]),
      )
      .mockResolvedValueOnce(okStream([chunk({ content: "done" }, "stop")]));

    const first = await chatCompletionMessage(MESSAGES);
    await chatCompletionMessage([
      ...MESSAGES,
      { role: "assistant", content: null, tool_calls: first.toolCalls },
      { role: "tool", tool_call_id: first.toolCalls[0]!.id, content: "[]" },
    ]);

    const echoed = sentBody(1).messages[1].tool_calls[0].function.arguments;
    expect(echoed).not.toBe("");
    expect(JSON.parse(echoed)).toEqual({});
  });

  it("leaves real arguments untouched", async () => {
    fetchMock.mockResolvedValue(
      okStream([
        chunk({
          tool_calls: [
            {
              index: 0,
              id: "c0",
              function: { name: "set_rect", arguments: '{"id":"a"}' },
            },
          ],
        }),
        chunk({}, "tool_calls"),
      ]),
    );

    const done = last(await drain(chatCompletionEvents(MESSAGES))) as {
      message: { toolCalls: Array<{ function: { arguments: string } }> };
    };
    expect(done.message.toolCalls[0]!.function.arguments).toBe('{"id":"a"}');
  });

  it("keeps interleaved parallel tool calls separate", async () => {
    // Two calls streaming at once. Appending by arrival order rather than by
    // index would splice their arguments into one unparseable string.
    fetchMock.mockResolvedValue(
      okStream([
        chunk({
          tool_calls: [
            { index: 0, id: "a", function: { name: "one", arguments: "{" } },
            { index: 1, id: "b", function: { name: "two", arguments: "{" } },
          ],
        }),
        chunk({
          tool_calls: [
            { index: 1, function: { arguments: '"y":2}' } },
            { index: 0, function: { arguments: '"x":1}' } },
          ],
        }),
        chunk({}, "tool_calls"),
      ]),
    );

    const done = last(await drain(chatCompletionEvents(MESSAGES))) as {
      message: { toolCalls: Array<{ function: { arguments: string } }> };
    };
    expect(done.message.toolCalls.map((c) => c.function.arguments)).toEqual([
      '{"x":1}',
      '{"y":2}',
    ]);
  });

  it("handles a provider that omits the tool call index", async () => {
    fetchMock.mockResolvedValue(
      okStream([
        chunk({
          tool_calls: [{ id: "a", function: { name: "one", arguments: "{}" } }],
        }),
        chunk({}, "tool_calls"),
      ]),
    );
    const done = last(await drain(chatCompletionEvents(MESSAGES))) as {
      message: { toolCalls: Array<{ function: { name: string } }> };
    };
    expect(done.message.toolCalls).toHaveLength(1);
    expect(done.message.toolCalls[0]!.function.name).toBe("one");
  });

  it("synthesises an id when the provider never sent one", async () => {
    // A tool result message must quote a tool_call_id, and an empty one is
    // rejected by the next request in the conversation.
    fetchMock.mockResolvedValue(
      okStream([
        chunk({
          tool_calls: [
            { index: 0, function: { name: "one", arguments: "{}" } },
          ],
        }),
        chunk({}, "tool_calls"),
      ]),
    );
    const done = last(await drain(chatCompletionEvents(MESSAGES))) as {
      message: { toolCalls: Array<{ id: string }> };
    };
    expect(done.message.toolCalls[0]!.id).toBe("call_0");
  });

  it("surfaces usage from the trailing usage-only chunk", async () => {
    fetchMock.mockResolvedValue(
      okStream([
        chunk({ content: "x" }, "stop"),
        JSON.stringify({
          choices: [],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
            cost: 0.002,
            completion_tokens_details: { reasoning_tokens: 3 },
          },
        }),
      ]),
    );

    const done = last(await drain(chatCompletionEvents(MESSAGES))) as {
      message: { usage: unknown };
    };
    expect(done.message.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      reasoningTokens: 3,
      costUsd: 0.002,
    });
  });

  it("flags a truncated reply", async () => {
    fetchMock.mockResolvedValue(
      okStream([chunk({ content: "cut off" }, "length")]),
    );
    const done = last(await drain(chatCompletionEvents(MESSAGES))) as {
      message: { truncated: boolean };
    };
    expect(done.message.truncated).toBe(true);
  });

  it("throws on an error delivered inside a 200 stream", async () => {
    fetchMock.mockResolvedValue(
      okStream([JSON.stringify({ error: { message: "upstream died" } })]),
    );
    await expect(drain(chatCompletionEvents(MESSAGES))).rejects.toThrow(
      /upstream died/,
    );
  });

  it("ignores frames it cannot parse", async () => {
    fetchMock.mockResolvedValue(
      okStream(["not json at all", chunk({ content: "ok" }, "stop")]),
    );
    const done = last(await drain(chatCompletionEvents(MESSAGES))) as {
      message: { content: string };
    };
    expect(done.message.content).toBe("ok");
  });

  it("requests usage and sends tools on the streaming path", async () => {
    fetchMock.mockResolvedValue(okStream([chunk({}, "stop")]));
    await drain(
      chatCompletionEvents(MESSAGES, {
        tools: [
          {
            type: "function",
            function: { name: "t", description: "d", parameters: {} },
          },
        ],
      }),
    );

    const body = sentBody();
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
    // The old streaming path silently dropped tools entirely.
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toBe("auto");
  });

  it("sends effort and budget alongside the reasoning flag", async () => {
    // `enabled: true` on its own gets no thinking out of Anthropic-style models,
    // which is why the panel showed no "Thought" section.
    fetchMock.mockResolvedValue(okStream([chunk({}, "stop")]));
    await drain(
      chatCompletionEvents(MESSAGES, {
        reasoningEnabled: true,
        reasoningEffort: "low",
        reasoningMaxTokens: 1024,
      }),
    );
    expect(sentBody().reasoning).toEqual({
      enabled: true,
      effort: "low",
      max_tokens: 1024,
    });
  });

  it("omits reasoning entirely when nothing about it was asked for", async () => {
    fetchMock.mockResolvedValue(okStream([chunk({}, "stop")]));
    await drain(chatCompletionEvents(MESSAGES));
    expect(sentBody()).not.toHaveProperty("reasoning");
  });

  it("omits tools rather than sending an empty array", async () => {
    fetchMock.mockResolvedValue(okStream([chunk({}, "stop")]));
    await drain(chatCompletionEvents(MESSAGES, { tools: [] }));
    expect(sentBody()).not.toHaveProperty("tools");
  });

  it("aborts the request when the consumer stops early", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return Promise.resolve(
        okStream([chunk({ content: "a" }), chunk({ content: "b" })]),
      );
    });

    for await (const event of chatCompletionEvents(MESSAGES)) {
      if (event.type === "content") break;
    }

    // Otherwise an abandoned generator leaves the connection open and the
    // tokens billing.
    expect(signal?.aborted).toBe(true);
  });

  it("passes a caller's abort signal through to fetch", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockResolvedValue(okStream([chunk({}, "stop")]));

    await expect(
      drain(chatCompletionEvents(MESSAGES, { signal: controller.signal })),
    ).rejects.toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("chatCompletionStream", () => {
  it("yields only the text deltas", async () => {
    fetchMock.mockResolvedValue(
      okStream([
        chunk({ reasoning: "ignored" }),
        chunk({ content: "a" }),
        chunk({ content: "b" }, "stop"),
      ]),
    );

    const seen: string[] = [];
    for await (const delta of chatCompletionStream(MESSAGES)) seen.push(delta);
    expect(seen).toEqual(["a", "b"]);
  });
});

describe("chatCompletion", () => {
  it("returns the trimmed text", async () => {
    fetchMock.mockResolvedValue(
      okStream([chunk({ content: "  spaced  " }, "stop")]),
    );
    expect(await chatCompletion(MESSAGES)).toBe("spaced");
  });
});

describe("chatCompletionMessage", () => {
  it("uses the non-streaming endpoint when asked", async () => {
    fetchMock.mockResolvedValue(
      okJson({
        choices: [
          {
            message: { content: "plain", reasoning: "why" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      }),
    );

    const message = await chatCompletionMessage(MESSAGES, { stream: false });
    expect(sentBody().stream).toBe(false);
    expect(message).toMatchObject({
      content: "plain",
      reasoning: "why",
      finishReason: "stop",
      usage: { totalTokens: 3 },
    });
  });

  it("throws on an error object returned with a 200", async () => {
    fetchMock.mockResolvedValue(okJson({ error: { message: "no capacity" } }));
    await expect(
      chatCompletionMessage(MESSAGES, { stream: false }),
    ).rejects.toThrow(/no capacity/);
  });
});

describe("retries", () => {
  it("retries a 429 and succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response("slow down", {
          status: 429,
          headers: { "retry-after": "0" },
        }),
      )
      .mockResolvedValueOnce(okStream([chunk({ content: "ok" }, "stop")]));

    const message = await chatCompletionMessage(MESSAGES);
    expect(message.content).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a 500", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("boom", { status: 503 }))
      .mockResolvedValueOnce(okStream([chunk({ content: "ok" }, "stop")]));

    expect((await chatCompletionMessage(MESSAGES)).content).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 400, which fails identically every time", async () => {
    fetchMock.mockResolvedValue(new Response("bad", { status: 400 }));
    await expect(chatCompletionMessage(MESSAGES)).rejects.toThrow(
      AIRequestError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 401", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 401 }));
    await expect(chatCompletionMessage(MESSAGES)).rejects.toMatchObject({
      status: 401,
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxRetries", async () => {
    fetchMock.mockResolvedValue(
      new Response("busy", { status: 429, headers: { "retry-after": "0" } }),
    );
    await expect(
      chatCompletionMessage(MESSAGES, { maxRetries: 1 }),
    ).rejects.toThrow(/429/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("can be disabled", async () => {
    fetchMock.mockResolvedValue(new Response("busy", { status: 429 }));
    await expect(
      chatCompletionMessage(MESSAGES, { maxRetries: 0 }),
    ).rejects.toThrow(/429/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a transport failure", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(okStream([chunk({ content: "ok" }, "stop")]));
    expect((await chatCompletionMessage(MESSAGES)).content).toBe("ok");
  });
});

describe("timeouts", () => {
  it("reports a timeout rather than a bare abort", async () => {
    // A body that never produces anything, so only the timer can end it.
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream({ start() {} }), { status: 200 }),
    );

    await expect(
      chatCompletionMessage(MESSAGES, {
        timeoutMs: 20,
        idleTimeoutMs: 20,
        maxRetries: 0,
      }),
    ).rejects.toThrow(/timed out/);
  });

  it("reports a mid-stream stall as a timeout", async () => {
    // The headers arrive and a chunk lands, then the provider goes quiet. Only
    // the idle timer can end this, and it must not look like a cancellation.
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(`data: ${chunk({ content: "a" })}\n\n`),
            );
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      chatCompletionMessage(MESSAGES, {
        timeoutMs: 5_000,
        idleTimeoutMs: 20,
        maxRetries: 0,
      }),
    ).rejects.toThrow(/timed out/);
  });

  it("propagates a caller's cancellation as an abort, not a timeout", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(encoder.encode(`data: ${chunk({ content: "a" })}\n\n`));
          },
        }),
        { status: 200 },
      ),
    );

    setTimeout(() => controller.abort(), 10);
    // Distinguishable on purpose: a user closing a panel must not be logged as
    // a provider failure.
    await expect(
      chatCompletionMessage(MESSAGES, {
        signal: controller.signal,
        timeoutMs: 5_000,
        idleTimeoutMs: 5_000,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("still reports a timeout when the caller also aborts", async () => {
    // The race: the timer fires, and the user closes the panel before the
    // rejection is classified, so `timedOut` and `signal.aborted` are both
    // true. Preferring the caller's reason there files a real provider timeout
    // as a user cancellation — and cancellations are deliberately not logged,
    // so the failure would vanish rather than being diagnosable.
    //
    // Driven from inside the fetch mock because wall-clock timing cannot hit
    // this window reliably: the rejection normally settles well before any
    // later abort lands.
    const controller = new AbortController();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          (init.signal as AbortSignal).addEventListener("abort", () => {
            // The timeout has now fired. Cancel as the user would, before the
            // rejection propagates.
            controller.abort();
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    );

    await expect(
      chatCompletionMessage(MESSAGES, {
        signal: controller.signal,
        timeoutMs: 20,
        idleTimeoutMs: 20,
        maxRetries: 0,
      }),
    ).rejects.toThrow(/timed out/);
  });

  it("does not time out a stream that keeps producing", async () => {
    // Chunks spaced under the idle timeout but totalling more than it: a
    // wall-clock-only implementation would kill this healthy stream.
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          async start(controller) {
            for (const text of ["a", "b", "c", "d"]) {
              await new Promise((r) => setTimeout(r, 15));
              controller.enqueue(
                encoder.encode(`data: ${chunk({ content: text })}\n\n`),
              );
            }
            controller.enqueue(
              encoder.encode(`data: ${chunk({}, "stop")}\n\n`),
            );
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );

    const message = await chatCompletionMessage(MESSAGES, {
      timeoutMs: 5_000,
      idleTimeoutMs: 40,
    });
    expect(message.content).toBe("abcd");
  });
});
