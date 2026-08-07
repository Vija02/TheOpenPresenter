import { logger } from "@repo/observability";

import {
  ChatCompletionOptions,
  ChatMessage,
  ChatResponseMessage,
  ChatStreamEvent,
  ChatTool,
} from "./types";

export type DocAgentTurn = { role: "user" | "assistant"; content: string };

export type DocAgentStep<TDoc> =
  | { type: "thinkingDelta"; text: string }
  | { type: "messageDelta"; text: string }
  | { type: "toolPending"; name: string }
  /** `doc` is present only when the call changed it, and is cumulative. */
  | { type: "tool"; name: string; summary: string; doc?: TDoc }
  | { type: "toolError"; name: string; message: string }
  | { type: "message"; text: string }
  /** Always last, and always carries a document, changed or not. */
  | { type: "done"; doc: TDoc; changed: boolean };

/**
 * Everything domain-specific about a run
 */
export type DocAgentToolset<TDoc> = {
  tools: ChatTool[];
  buildMessages: (
    request: string,
    history: DocAgentTurn[],
    image?: string | null,
  ) => ChatMessage[];
  apply: (
    doc: TDoc,
    name: string,
    args: unknown,
  ) => { doc: TDoc; summary: string };
  isReadOnly: (name: string) => boolean;
  readOnlySummary?: string;
};

export type DocAgentAi = {
  chatCompletionEvents: (
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ) => AsyncGenerator<ChatStreamEvent, void, unknown>;
};

/** Between them, the difference between a slow run and one that never returns. */
export type DocAgentLimits = {
  maxTurns?: number;
  turnTimeoutMs?: number;
  runBudgetMs?: number;
  /** Separate from maxTurns because one turn can request several calls. */
  maxToolCalls?: number;
};

export type RunDocAgentOptions<TDoc> = DocAgentLimits & {
  ai: DocAgentAi;
  toolset: DocAgentToolset<TDoc>;
  doc: TDoc;
  request: string;
  history?: DocAgentTurn[];
  image?: string | null;
  signal?: AbortSignal;
  name?: string;
};

const DEFAULTS: Required<DocAgentLimits> = {
  maxTurns: 12,
  turnTimeoutMs: 90_000,
  runBudgetMs: 180_000,
  maxToolCalls: 40,
};

const TOO_MANY_STEPS =
  "Stopped after too many steps. Some of the request may be unfinished.";

type Turn = { reply: ChatResponseMessage };

const streamTurn = async function* <TDoc>(
  options: RunDocAgentOptions<TDoc>,
  messages: ChatMessage[],
  deadline: number,
  out: Turn,
): AsyncGenerator<DocAgentStep<TDoc>, void, unknown> {
  const remaining = deadline - Date.now();
  const turnTimeoutMs = options.turnTimeoutMs ?? DEFAULTS.turnTimeoutMs;

  const events = options.ai.chatCompletionEvents(messages, {
    temperature: 0,
    timeoutMs: Math.min(turnTimeoutMs, Math.max(1_000, remaining)),
    reasoningEnabled: true,
    // DEBT: Make configurable
    reasoningEffort: "low",
    tools: options.toolset.tools,
    ...(options.image ? { provider: "vision" } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  const announced = new Set<number>();

  for await (const event of events) {
    switch (event.type) {
      case "reasoning":
        yield { type: "thinkingDelta", text: event.delta };
        break;
      case "content":
        yield { type: "messageDelta", text: event.delta };
        break;
      case "toolCall":
        if (event.name && !announced.has(event.index)) {
          announced.add(event.index);
          yield { type: "toolPending", name: event.name };
        }
        break;
      case "done":
        out.reply = event.message;
        break;
    }
  }
};

export const runDocAgent = async function* <TDoc>(
  options: RunDocAgentOptions<TDoc>,
): AsyncGenerator<DocAgentStep<TDoc>, void, unknown> {
  const {
    toolset,
    request,
    history = [],
    image = null,
    name = "doc agent",
  } = options;
  const maxTurns = options.maxTurns ?? DEFAULTS.maxTurns;
  const maxToolCalls = options.maxToolCalls ?? DEFAULTS.maxToolCalls;

  let current = options.doc;
  let changed = false;
  let toolCallCount = 0;
  const deadline = Date.now() + (options.runBudgetMs ?? DEFAULTS.runBudgetMs);

  const messages = toolset.buildMessages(request, history, image);

  // Why the loop ended, when that is worth telling the user
  let stopped: string | null = null;

  for (let turn = 0; turn < maxTurns; turn++) {
    if (options.signal?.aborted) return;

    if (Date.now() >= deadline) {
      stopped =
        "Stopped: this took too long. Some of the request may be unfinished.";
      break;
    }

    const out: Turn = { reply: undefined as unknown as ChatResponseMessage };
    try {
      yield* streamTurn(options, messages, deadline, out);
    } catch (err) {
      // A failed round-trip ends the run but must not discard it: throwing would
      // send the client a `fatal` and silently lose edits it already watched land.
      if (options.signal?.aborted) return;
      logger.error({ err, turn, agent: name }, "doc agent turn failed");
      stopped = changed
        ? "The AI stopped early, so this may be unfinished. Your applied changes have been kept."
        : `The AI request failed: ${err instanceof Error ? err.message : String(err)}`;
      break;
    }

    const reply = out.reply;
    // The stream ended without a `done` event, which should not happen.
    if (!reply) {
      stopped = "The model stopped responding.";
      break;
    }

    if (reply.truncated && reply.toolCalls.length === 0) {
      stopped = "The reply was cut short. Try asking for one change at a time.";
      break;
    }

    // The model considers itself finished. The prose already streamed as deltas;
    // this is the turn record for the transcript, not a repeat of it.
    if (reply.toolCalls.length === 0) {
      if (reply.content) yield { type: "message", text: reply.content };
      yield { type: "done", doc: current, changed };
      return;
    }

    messages.push({
      role: "assistant",
      content: reply.content || null,
      tool_calls: reply.toolCalls,
    });

    for (const call of reply.toolCalls) {
      const toolName = call.function.name;
      let result: string;

      try {
        let args: unknown;
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          throw new Error(
            "Arguments were not valid JSON. Send the call again with valid JSON.",
          );
        }

        const applied = toolset.apply(current, toolName, args);
        current = applied.doc;
        result = applied.summary;

        if (toolset.isReadOnly(toolName)) {
          yield {
            type: "tool",
            name: toolName,
            summary: toolset.readOnlySummary ?? "Read the document.",
          };
        } else {
          changed = true;
          yield {
            type: "tool",
            name: toolName,
            summary: applied.summary,
            doc: current,
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result = `Error: ${message}`;
        yield { type: "toolError", name: toolName, message };
      }

      messages.push({ role: "tool", tool_call_id: call.id, content: result });
      toolCallCount += 1;
    }

    if (toolCallCount >= maxToolCalls) {
      stopped = TOO_MANY_STEPS;
      break;
    }
  }

  if (options.signal?.aborted) return;

  // Reached only by `break`
  yield { type: "message", text: stopped ?? TOO_MANY_STEPS };
  yield { type: "done", doc: current, changed };
};
