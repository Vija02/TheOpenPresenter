import {
  AiCapabilityContext,
  AnyAiCapability,
  InvokeCapability,
  MAX_SPAWN_DEPTH,
} from "./capability";

export type CapabilityRegistry = {
  get(id: string): AnyAiCapability | undefined;
};

// Capability to spawn capability as children
export const createInvokeCapability = (
  registry: CapabilityRegistry,
  signal: AbortSignal,
  depth: number,
): InvokeCapability =>
  async function* (id, input) {
    if (depth + 1 > MAX_SPAWN_DEPTH) {
      throw new Error(
        `Refusing to spawn "${id}": max capability depth (${MAX_SPAWN_DEPTH}) reached.`,
      );
    }
    const capability = registry.get(id);
    if (!capability) {
      throw new Error(`No AI capability "${id}" is registered.`);
    }

    const childContext: AiCapabilityContext<unknown> = {
      body: input,
      signal,
      depth: depth + 1,
      invokeCapability: createInvokeCapability(registry, signal, depth + 1),
    };

    yield* capability.handler(childContext);
  };
