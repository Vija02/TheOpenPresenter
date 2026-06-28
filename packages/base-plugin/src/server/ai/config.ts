/**
 * We talk to providers using the OpenAI-compatible Chat Completions API shape.
 *
 * Env vars (server-side only - never expose the API key to the client):
 *   AI_API_KEY   (required) - provider API key
 *   AI_BASE_URL  (optional) - defaults to OpenRouter
 *   AI_MODEL     (optional) - defaults to openrouter/free
 */
export type AIProviderConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
};

const DEFAULTS = {
  baseURL: "https://openrouter.ai/api/v1",
  model: "openrouter/free",
};

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigError";
  }
}

export const isAIConfigured = (): boolean => !!process.env.AI_API_KEY;

/**
 * Resolves a provider's credentials + default model from the environment.
 *
 *   getProvider()             -> default provider: AI_API_KEY / AI_BASE_URL / AI_MODEL
 *   getProvider("openrouter") -> AI_OPENROUTER_API_KEY / AI_OPENROUTER_BASE_URL / AI_OPENROUTER_MODEL
 *
 * If a named provider has no API key configured, we fall back to the default
 * provider — so a profile can request a provider without every deployment
 * having to configure it.
 */
export const getProvider = (name?: string): AIProviderConfig => {
  if (name && name !== "default") {
    const prefix = `AI_${name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_`;
    const apiKey = process.env[`${prefix}API_KEY`];
    if (apiKey) {
      const baseURL = (
        process.env[`${prefix}BASE_URL`] ?? DEFAULTS.baseURL
      ).replace(/\/+$/, "");
      const model =
        process.env[`${prefix}MODEL`] ?? process.env.AI_MODEL ?? DEFAULTS.model;
      return { apiKey, baseURL, model };
    }
    // Named provider not configured -> fall back to the default provider below.
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      "AI is not configured. Set AI_API_KEY to enable AI features.",
    );
  }

  const baseURL = (process.env.AI_BASE_URL ?? DEFAULTS.baseURL).replace(
    /\/+$/,
    "",
  );
  const model = process.env.AI_MODEL ?? DEFAULTS.model;

  return { apiKey, baseURL, model };
};
