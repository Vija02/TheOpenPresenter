/**
 * We talk to providers using the OpenAI-compatible Chat Completions API shape.
 *
 * Env vars (server-side only - never expose the API key to the client):
 *   AI_API_KEY   (required) - provider API key
 *   AI_BASE_URL  (optional) - defaults to OpenRouter
 *   AI_MODEL     (optional) - defaults to openrouter/free
 *
 * Any of the three can be prefixed to scope it to a profile, most specific
 * winning: `AI_LAYOUT_VISION_MODEL`, `AI_LAYOUT_MODEL`, `AI_MODEL`. See
 * `getProvider`.
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

const envPrefix = (name: string): string =>
  `AI_${name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_`;

/**
 * Expands a dotted profile into the chain it should search,
 */
export const toProfiles = (name?: string): string[] => {
  if (!name) return [];
  const parts = name.split(".");
  return parts.map((_, i) => parts.slice(0, parts.length - i).join("."));
};

/**
 * Resolves a provider's credentials + model from the environment.
 *
 * Takes profiles most-specific first; each falls back to the next, and finally
 * to the bare `AI_*` vars:
 *
 *   getProvider()                      -> AI_API_KEY / AI_BASE_URL / AI_MODEL
 *   getProvider("layout")              -> AI_LAYOUT_*      -> AI_*
 *   getProvider("layout.vision", "layout")
 *                                      -> AI_LAYOUT_VISION_* -> AI_LAYOUT_* -> AI_*
 */
export const getProvider = (
  ...profiles: (string | undefined)[]
): AIProviderConfig => {
  const prefixes = profiles
    .filter((name): name is string => !!name && name !== "default")
    .map(envPrefix);

  // The first profile that supplies a key owns the host too.
  const keyed = prefixes.find((prefix) => process.env[`${prefix}API_KEY`]);

  const apiKey = keyed
    ? process.env[`${keyed}API_KEY`]!
    : process.env.AI_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      "AI is not configured. Set AI_API_KEY to enable AI features.",
    );
  }

  const baseURL = (
    (keyed ? process.env[`${keyed}BASE_URL`] : process.env.AI_BASE_URL) ||
    DEFAULTS.baseURL
  ).replace(/\/+$/, "");

  const model =
    prefixes
      .map((prefix) => process.env[`${prefix}MODEL`])
      .find((value) => !!value) ||
    process.env.AI_MODEL ||
    DEFAULTS.model;

  return { apiKey, baseURL, model };
};
