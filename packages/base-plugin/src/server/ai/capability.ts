/** How deep capability spawning may nest before it is refused. */
export const MAX_SPAWN_DEPTH = 2;

export type InvokeCapability = (
  id: string,
  input: unknown,
) => AsyncGenerator<unknown, void, unknown>;

export type AiCapabilityContext<T> = {
  body: T;
  signal: AbortSignal;
  depth: number;
  invokeCapability: InvokeCapability;
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
