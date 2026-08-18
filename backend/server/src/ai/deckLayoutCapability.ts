import {
  AiCapability,
  ServerPluginApiPrivate,
  runDocAgent,
} from "@repo/base-plugin/server";
import { layoutDocValidator } from "@repo/layout";
import { createDeckAgentToolset } from "@repo/layout/ai";
import z from "zod";

const imageInput = z
  .string()
  .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Expected an image data URL")
  .max(6_000_000)
  .nullish();

const deckInput = z.object({
  doc: z.object({
    slides: z.array(layoutDocValidator).max(500),
  }),
  request: z.string().min(1).max(20000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .default([]),
  image: imageInput,
  context: z.string().max(2000).nullish(),
});

// A pasted script can be long
const MAX_BODY_BYTES = 24 * 1024 * 1024;

export const LAYOUT_DECK_CAPABILITY_ID = "layout-deck";

/** Deck-level layout editing */
export const deckLayoutCapability = (
  serverPluginApi: ServerPluginApiPrivate,
): AiCapability<z.infer<typeof deckInput>> => ({
  id: LAYOUT_DECK_CAPABILITY_ID,
  parse: (raw) => deckInput.parse(raw),
  maxBodyBytes: MAX_BODY_BYTES,
  handler: ({ body, signal, invokeCapability }) =>
    runDocAgent({
      ai: serverPluginApi.ai,
      toolset: createDeckAgentToolset(body.context),
      doc: body.doc,
      request: body.request,
      history: body.history,
      image: body.image,
      signal,
      invokeCapability,
      name: LAYOUT_DECK_CAPABILITY_ID,
      // Building a whole deck is many tool calls (one+ per slide)
      maxTurns: 40,
      maxToolCalls: 200,
      runBudgetMs: 600_000,
      turnTimeoutMs: 240_000,
      idleTimeoutMs: 120_000,
      reasoningEffort: "low",
    }),
});
