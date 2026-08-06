import { readSseEvents } from "@repo/lib";
import { logger } from "@repo/observability";

import { getProvider } from "./config";
import {
  AIRequestError,
  ChatCompletionOptions,
  ChatFinishReason,
  ChatMessage,
  ChatResponseMessage,
  ChatStreamEvent,
  ChatToolCall,
  ChatUsage,
} from "./types";

const DEFAULT_TIMEOUT_MS = 60_000;
// Reasoning might take awhile
const DEFAULT_IDLE_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 8_000;

/* -------------------------------------------------------------------------- */
/* Errors and cancellation                                                    */
/* -------------------------------------------------------------------------- */

const isAbortError = (err: unknown): boolean => {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current; depth++) {
    const name = (current as { name?: unknown }).name;
    if (name === "AbortError" || name === "TimeoutError") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
};

const isNetworkError = (err: unknown): boolean =>
  err instanceof TypeError ||
  (err instanceof Error && err.name === "FetchError");

const isRetryableStatus = (status: number): boolean =>
  status === 408 ||
  status === 409 ||
  status === 425 ||
  status === 429 ||
  status >= 500;

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

const retryDelayMs = (attempt: number, retryAfter: string | null): number => {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
    }
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) {
      return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_DELAY_MS);
    }
  }
  const ceiling = Math.min(500 * 2 ** attempt, MAX_RETRY_DELAY_MS);
  return Math.round(ceiling * (0.5 + Math.random() * 0.5));
};

/* -------------------------------------------------------------------------- */
/* Request construction                                                       */
/* -------------------------------------------------------------------------- */

const buildBody = (
  messages: ChatMessage[],
  options: ChatCompletionOptions,
  model: string,
  stream: boolean,
): string =>
  JSON.stringify({
    model: options.model ?? model,
    messages,
    temperature: options.temperature ?? 0,
    stream,
    ...(options.maxTokens !== undefined
      ? { max_tokens: options.maxTokens }
      : {}),
    // `enabled` alone is not enough for every provider
    ...(options.reasoningEnabled !== undefined ||
    options.reasoningEffort !== undefined ||
    options.reasoningMaxTokens !== undefined
      ? {
          reasoning: {
            ...(options.reasoningEnabled !== undefined
              ? { enabled: options.reasoningEnabled }
              : {}),
            ...(options.reasoningEffort !== undefined
              ? { effort: options.reasoningEffort }
              : {}),
            ...(options.reasoningMaxTokens !== undefined
              ? { max_tokens: options.reasoningMaxTokens }
              : {}),
          },
        }
      : {}),
    // Omitted entirely when empty rather than sent as []
    ...(options.tools?.length
      ? { tools: options.tools, tool_choice: options.toolChoice ?? "auto" }
      : {}),
    ...(stream && options.includeUsage !== false
      ? { stream_options: { include_usage: true } }
      : {}),
    ...options.extraBody,
  });

type Attempt = {
  res: Response;
  controller: AbortController;
  keepAlive: () => void;
  release: () => void;
  readonly timedOut: boolean;
};

const openRequest = async (
  messages: ChatMessage[],
  options: ChatCompletionOptions,
  stream: boolean,
): Promise<Attempt> => {
  const { apiKey, baseURL, model } = getProvider(options.provider);

  const controller = new AbortController();
  const total = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const idle = stream
    ? (options.idleTimeoutMs ?? Math.min(DEFAULT_IDLE_TIMEOUT_MS, total))
    : null;

  let timedOut = false;
  const abortAsTimeout = () => {
    timedOut = true;
    controller.abort();
  };

  const totalTimer = setTimeout(abortAsTimeout, total);
  let idleTimer: ReturnType<typeof setTimeout> | null =
    idle === null ? null : setTimeout(abortAsTimeout, idle);

  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onCallerAbort, { once: true });

  const release = () => {
    clearTimeout(totalTimer);
    if (idleTimer) clearTimeout(idleTimer);
    options.signal?.removeEventListener("abort", onCallerAbort);
  };

  const keepAlive = () => {
    if (idle === null) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(abortAsTimeout, idle);
  };

  try {
    if (options.signal?.aborted) throw options.signal.reason;

    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: stream ? "text/event-stream" : "application/json",
      },
      body: buildBody(messages, options, model, stream),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      release();
      throw new AIRequestError(
        `AI request failed (${res.status} ${res.statusText}): ${body.slice(0, 500)}`,
        {
          status: res.status,
          retryable: isRetryableStatus(res.status),
          requestId: res.headers.get("x-request-id") ?? undefined,
          retryAfter: res.headers.get("retry-after"),
        },
      );
    }

    // A streaming request that came back without a body has nothing to read and
    // will not produce one; treat it as the transport failure it is.
    if (stream && !res.body) {
      release();
      throw new AIRequestError("AI response had no body", { retryable: true });
    }

    return {
      res,
      controller,
      keepAlive,
      release,
      get timedOut() {
        return timedOut;
      },
    };
  } catch (err) {
    release();
    throw normalizeError(err, timedOut, options.signal);
  }
};

/**
 * Maps a thrown value onto our error type, keeping cancellation distinguishable
 * from failure
 */
const normalizeError = (
  err: unknown,
  timedOut: boolean,
  signal: AbortSignal | undefined,
): unknown => {
  if (err instanceof AIRequestError) return err;

  if (isAbortError(err) || signal?.aborted) {
    // The caller's own cancellation propagates unchanged, so `signal.reason`
    // survives and downstream `aborted` checks behave as expected.
    if (signal?.aborted && !timedOut) return signal.reason ?? err;
    return new AIRequestError("AI request timed out", { cause: err });
  }

  if (isNetworkError(err)) {
    return new AIRequestError(
      `AI request could not reach the provider: ${(err as Error).message}`,
      { retryable: true, cause: err },
    );
  }

  return err;
};

/**
 * Runs `attempt` until it succeeds, fails unretryably, or runs out of attempts.
 */
const withRetries = async (
  options: ChatCompletionOptions,
  attempt: () => Promise<Attempt>,
): Promise<Attempt> => {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  for (let n = 0; ; n++) {
    try {
      return await attempt();
    } catch (err) {
      const retryable = err instanceof AIRequestError && err.retryable;
      if (!retryable || n >= maxRetries || options.signal?.aborted) throw err;

      const delay = retryDelayMs(n, err.retryAfter ?? null);
      logger.warn(
        {
          status: err.status,
          requestId: err.requestId,
          attempt: n + 1,
          delay,
        },
        "AI request failed, retrying",
      );
      await sleep(delay, options.signal);
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Response parsing                                                           */
/* -------------------------------------------------------------------------- */

type WireUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
  prompt_tokens_details?: { cached_tokens?: number };
};

const parseUsage = (usage: WireUsage | null | undefined): ChatUsage | null => {
  if (!usage) return null;
  const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens;
  const cachedPromptTokens = usage.prompt_tokens_details?.cached_tokens;
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens:
      usage.total_tokens ??
      (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
    ...(cachedPromptTokens !== undefined ? { cachedPromptTokens } : {}),
    ...(usage.cost !== undefined ? { costUsd: usage.cost } : {}),
  };
};

const pickReasoning = (source: {
  reasoning?: string | null;
  reasoning_content?: string | null;
}): string | undefined =>
  source.reasoning ?? source.reasoning_content ?? undefined;

type WireMessage = {
  content?: string | null;
  tool_calls?: ChatToolCall[];
  reasoning?: string | null;
  reasoning_content?: string | null;
};

/** Guarantees `arguments` is a JSON object literal. */
const normalizeToolCalls = (
  calls: ChatToolCall[] | undefined,
): ChatToolCall[] =>
  (calls ?? []).map((call) => {
    const args = call.function?.arguments?.trim();
    return args
      ? call
      : { ...call, function: { ...call.function, arguments: "{}" } };
  });

type WireResponse = {
  choices?: Array<{ message?: WireMessage; finish_reason?: string | null }>;
  usage?: WireUsage | null;
  error?: { message?: string; code?: string | number };
};

/** Logged rather than returned: cost belongs in the logs on every call. */
const logUsage = (
  model: string | undefined,
  usage: ChatUsage | null,
  finishReason: ChatFinishReason | null,
) => {
  if (!usage) return;
  logger.debug({ model, usage, finishReason }, "AI request completed");
};

const toResponseMessage = (
  message: WireMessage | undefined,
  finishReason: ChatFinishReason | null,
  usage: ChatUsage | null,
): ChatResponseMessage => ({
  content: message?.content?.trim() ?? "",
  toolCalls: normalizeToolCalls(message?.tool_calls),
  reasoning: pickReasoning(message ?? {})?.trim() || null,
  finishReason,
  usage,
  truncated: finishReason === "length",
});

/* -------------------------------------------------------------------------- */
/* Non-streaming                                                              */
/* -------------------------------------------------------------------------- */

const postChat = async (
  messages: ChatMessage[],
  options: ChatCompletionOptions,
): Promise<ChatResponseMessage> => {
  const attempt = await withRetries(options, () =>
    openRequest(messages, options, false),
  );

  try {
    const data = (await attempt.res.json()) as WireResponse;

    // A 200 carrying an error object. OpenRouter does this when an upstream
    // model fails after the response has already been committed.
    if (data.error) {
      throw new AIRequestError(
        `AI provider returned an error: ${data.error.message ?? "unknown"}`,
        { retryable: true },
      );
    }

    const choice = data.choices?.[0];
    const usage = parseUsage(data.usage);
    const finishReason = choice?.finish_reason ?? null;
    logUsage(options.model, usage, finishReason);
    return toResponseMessage(choice?.message, finishReason, usage);
  } catch (err) {
    // The timer can fire while the body is still being read, so this covers a
    // response that starts arriving and then stalls.
    throw normalizeError(err, attempt.timedOut, options.signal);
  } finally {
    attempt.release();
  }
};

/* -------------------------------------------------------------------------- */
/* Streaming                                                                  */
/* -------------------------------------------------------------------------- */

type WireDelta = {
  content?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
  tool_calls?: Array<{
    index?: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
  }>;
};

type WireChunk = {
  choices?: Array<{ delta?: WireDelta; finish_reason?: string | null }>;
  usage?: WireUsage | null;
  error?: { message?: string; code?: string | number };
};

type PartialToolCall = { id: string; name: string; args: string };

/** Accumulates streamed tool call fragments into whole calls. */
class ToolCallAccumulator {
  private calls: PartialToolCall[] = [];
  private lastIndex = -1;

  /**
   * Applies one delta and reports what changed.
   */
  push(delta: NonNullable<WireDelta["tool_calls"]>[number]): {
    index: number;
    started: boolean;
  } {
    const index =
      delta.index ??
      (delta.function?.name || this.lastIndex < 0
        ? this.calls.length
        : this.lastIndex);
    this.lastIndex = index;

    const existing = this.calls[index];
    const call: PartialToolCall = existing ?? { id: "", name: "", args: "" };
    if (delta.id) call.id = delta.id;
    if (delta.function?.name) call.name = delta.function.name;
    if (delta.function?.arguments) call.args += delta.function.arguments;
    this.calls[index] = call;

    return { index, started: !existing };
  }

  at(index: number): PartialToolCall {
    return this.calls[index] ?? { id: "", name: "", args: "" };
  }

  /**
   * The finished calls.
   */
  toToolCalls(): ChatToolCall[] {
    return this.calls
      .filter((call) => call && call.name)
      .map((call, i) => ({
        id: call.id || `call_${i}`,
        type: "function" as const,
        function: { name: call.name, arguments: call.args.trim() || "{}" },
      }));
  }
}

/**
 * The full streamed response, as events.
 */
export async function* chatCompletionEvents(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const attempt = await withRetries(options, () =>
    openRequest(messages, options, true),
  );

  let content = "";
  let reasoning = "";
  let finishReason: ChatFinishReason | null = null;
  let usage: ChatUsage | null = null;
  const toolCalls = new ToolCallAccumulator();
  let sawDone = false;

  try {
    for await (const event of readSseEvents(attempt.res.body!, {
      onActivity: attempt.keepAlive,
      // The same controller the timeouts and the caller's signal both fire, so
      // a stalled body cannot outlive them.
      signal: attempt.controller.signal,
    })) {
      if (event.data === "[DONE]") break;

      let chunk: WireChunk;
      try {
        chunk = JSON.parse(event.data);
      } catch {
        continue;
      }

      if (chunk.error) {
        throw new AIRequestError(
          `AI provider returned an error mid-stream: ${chunk.error.message ?? "unknown"}`,
          // Mid-stream, so anything already yielded has been seen by the
          // consumer. Retrying here would duplicate it.
          { retryable: false },
        );
      }

      // Usage arrives in its own trailing chunk when stream_options asked for
      // it, and that chunk has no choices at all.
      if (chunk.usage) usage = parseUsage(chunk.usage);

      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;

      const delta = choice.delta;
      if (!delta) continue;

      const reasoningDelta = pickReasoning(delta);
      if (reasoningDelta) {
        reasoning += reasoningDelta;
        yield { type: "reasoning", delta: reasoningDelta };
      }

      if (delta.content) {
        content += delta.content;
        yield { type: "content", delta: delta.content };
      }

      for (const call of delta.tool_calls ?? []) {
        const { index, started } = toolCalls.push(call);
        const current = toolCalls.at(index);
        yield {
          type: "toolCall",
          index,
          id: current.id,
          name: current.name,
          argumentsSoFar: current.args,
          started,
        };
      }
    }

    sawDone = true;
    const message: ChatResponseMessage = {
      content: content.trim(),
      toolCalls: toolCalls.toToolCalls(),
      reasoning: reasoning.trim() || null,
      finishReason,
      usage,
      truncated: finishReason === "length",
    };
    logUsage(options.model, usage, finishReason);
    yield { type: "done", message };
  } catch (err) {
    throw normalizeError(err, attempt.timedOut, options.signal);
  } finally {
    if (!sawDone) attempt.controller.abort();
    attempt.release();
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Drives a stream to completion and returns the assembled message.
 *
 * Preferred over the non-streaming request for anything slow: an idle timeout on
 * a live stream is a far better failure mode than a wall clock on a silent
 * connection, and intermediaries are much less likely to cut it off.
 */
export const collectChatStream = async (
  events: AsyncGenerator<ChatStreamEvent, void, unknown>,
): Promise<ChatResponseMessage> => {
  for await (const event of events) {
    if (event.type === "done") return event.message;
  }
  throw new AIRequestError("AI stream ended without a complete message", {
    retryable: true,
  });
};

/**
 * Sends a chat completion request to the configured provider using the
 * OpenAI-compatible `/chat/completions` endpoint
 */
export const chatCompletion = async (
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<string> => (await chatCompletionMessage(messages, options)).content;

/**
 * As `chatCompletion`, but returns the whole assistant message so a caller can
 * act on tool calls, truncation and usage rather than only prose.
 */
export const chatCompletionMessage = (
  messages: ChatMessage[],
  options: ChatCompletionOptions & { stream?: boolean } = {},
): Promise<ChatResponseMessage> =>
  options.stream === false
    ? postChat(messages, options)
    : collectChatStream(chatCompletionEvents(messages, options));

/**
 * Just the visible text, as it arrives.
 */
export async function* chatCompletionStream(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): AsyncGenerator<string, void, unknown> {
  for await (const event of chatCompletionEvents(messages, options)) {
    if (event.type === "content") yield event.delta;
  }
}
