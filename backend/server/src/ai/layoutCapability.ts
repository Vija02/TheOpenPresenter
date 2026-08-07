import {
  AiCapability,
  ServerPluginApiPrivate,
  runDocAgent,
} from "@repo/base-plugin/server";
import { layoutDocValidator } from "@repo/layout";
import { layoutAgentToolset } from "@repo/layout/ai";
import z from "zod";

const imageInput = z
  .string()
  .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Expected an image data URL")
  .max(6_000_000)
  .nullish();

export const layoutAgentInput = z.object({
  doc: layoutDocValidator,
  request: z.string().min(1).max(2000),
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
});

const MAX_BODY_BYTES = 8 * 1024 * 1024;

export const LAYOUT_CAPABILITY_ID = "layout";

/**
 * The default layout-editing capability.
 */
export const layoutCapability = (
  serverPluginApi: ServerPluginApiPrivate,
): AiCapability<z.infer<typeof layoutAgentInput>> => ({
  id: LAYOUT_CAPABILITY_ID,
  parse: (raw) => layoutAgentInput.parse(raw),
  maxBodyBytes: MAX_BODY_BYTES,
  handler: ({ body, signal }) =>
    runDocAgent({
      ai: serverPluginApi.ai,
      toolset: layoutAgentToolset,
      doc: body.doc,
      request: body.request,
      history: body.history,
      image: body.image,
      signal,
      name: LAYOUT_CAPABILITY_ID,
    }),
});
