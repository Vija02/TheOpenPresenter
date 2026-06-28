import { getProvider } from "./config";

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatCompletionOptions = {
  temperature?: number;
  timeoutMs?: number;
  model?: string;
  /**
   * Which configured provider to use. Defaults to the default provider. 
   * When provided, we need to set the relevant ENV
   */
  provider?: string;
  reasoningEnabled?: boolean;
};

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export class AIRequestError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AIRequestError";
    this.status = status;
  }
}

/**
 * Sends a chat completion request to the configured provider using the
 * OpenAI-compatible `/chat/completions` endpoint
 */
export const chatCompletion = async (
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<string> => {
  const { apiKey, baseURL, model } = getProvider(options.provider);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 60_000,
  );

  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model ?? model,
        messages,
        temperature: options.temperature ?? 0,
        stream: false,
        ...(options.reasoningEnabled !== undefined
          ? { reasoning: { enabled: options.reasoningEnabled } }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AIRequestError(
        `AI request failed (${res.status} ${res.statusText}): ${body.slice(0, 500)}`,
        res.status,
      );
    }

    const data = (await res.json()) as OpenAICompatibleResponse;
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AIRequestError("AI request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Streaming variant of chatCompletion
 */
export async function* chatCompletionStream(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): AsyncGenerator<string, void, unknown> {
  const { apiKey, baseURL, model } = getProvider(options.provider);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 60_000,
  );

  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model ?? model,
        messages,
        temperature: options.temperature ?? 0,
        stream: true,
        ...(options.reasoningEnabled !== undefined
          ? { reasoning: { enabled: options.reasoningEnabled } }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      throw new AIRequestError(
        `AI request failed (${res.status} ${res.statusText}): ${body.slice(0, 500)}`,
        res.status,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        for (const line of frame.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) yield delta;
          } catch {
            // keep-alive comment or partial frame - ignore
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AIRequestError("AI request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
