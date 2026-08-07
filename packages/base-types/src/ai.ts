/**
 * The OpenAI-compatible chat wire format.
 */

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

/** A tool offered to the model. */
export type ChatTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    /** Ask the provider to guarantee arguments match `parameters` exactly. */
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
