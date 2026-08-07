export type AiCapabilityContext<T> = {
  body: T;
  signal: AbortSignal;
};

export type AiCapability<T = unknown> = {
  /**
   * URL segment, so keep it path-safe. Dots namespace a plugin's own variants:
   * `layout`, `bible.layout`.
   */
  id: string;
  /** Throws to reject the request as a 400. */
  parse: (raw: unknown) => T;
  handler: (
    context: AiCapabilityContext<T>,
  ) => AsyncGenerator<unknown, void, unknown>;
  maxBodyBytes?: number;
};

/** Erased so a registry can hold capabilities with unrelated input types. */
export type AnyAiCapability = AiCapability<any>;
