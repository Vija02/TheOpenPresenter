export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" } };

/** A call the model wants made. `arguments` is a JSON string, not an object. */
export type ChatToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/** A tool offered to the model */
export type ChatTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    // Ask the provider to guarantee arguments match `parameters` exactly.
    strict?: boolean;
  };
};

export type ChatMessage = {
  role: ChatRole;
  /** Null on an assistant turn that carries only tool calls. */
  content: string | ChatContentPart[] | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
};

/**
 * Why the model stopped.
 *
 * `length` is the one worth branching on: it means the reply is truncated, and a
 * truncated JSON document is indistinguishable from a malformed one unless you
 * look here.
 */
export type ChatFinishReason =
  | "stop"
  | "length"
  | "tool_calls"
  | "content_filter"
  | "error"
  | (string & {});

export type ChatUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedPromptTokens?: number;
  costUsd?: number;
};

export type ChatCompletionOptions = {
  temperature?: number;
  timeoutMs?: number;
  idleTimeoutMs?: number;
  model?: string;
  provider?: string;
  reasoningEnabled?: boolean;
  // For some providers, we need to pass this to turn on reasoning
  reasoningEffort?: "low" | "medium" | "high";
  reasoningMaxTokens?: number;
  /** Caps the reply. Set it when a truncated answer is better than a slow one. */
  maxTokens?: number;
  /** Offered to the model. */
  tools?: ChatTool[];
  toolChoice?: "auto" | "none" | "required";
  /** Use for request cancellation */
  signal?: AbortSignal;
  maxRetries?: number;
  includeUsage?: boolean;
  /** Merged into the request body last, so it can override anything above. */
  extraBody?: Record<string, unknown>;
};

/** A complete assistant turn, however it was obtained. */
export type ChatResponseMessage = {
  content: string;
  toolCalls: ChatToolCall[];
  reasoning: string | null;
  finishReason: ChatFinishReason | null;
  usage: ChatUsage | null;
  /** True when `finishReason` is "length", i.e. the reply is cut off. */
  truncated: boolean;
};

/**
 * One thing that happened while a response streamed.
 *
 * `content` and `reasoning` are deltas, fragments to append, not snapshots.
 * `toolCall` is emitted once a call's name is known and again as its arguments
 * accumulate, carrying the assembled-so-far value: partial JSON arguments are
 * useless to parse but the *name* arriving early is what lets a UI say what is
 * happening before the call is complete.
 */
export type ChatStreamEvent =
  | { type: "content"; delta: string }
  | { type: "reasoning"; delta: string }
  | {
      type: "toolCall";
      index: number;
      id: string;
      name: string;
      argumentsSoFar: string;
      started: boolean;
    }
  | { type: "done"; message: ChatResponseMessage };

export class AIRequestError extends Error {
  status?: number;
  retryable: boolean;
  requestId?: string;
  retryAfter?: string;

  constructor(
    message: string,
    options: {
      status?: number;
      retryable?: boolean;
      requestId?: string;
      retryAfter?: string | null;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    this.name = "AIRequestError";
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter ?? undefined;
  }
}
