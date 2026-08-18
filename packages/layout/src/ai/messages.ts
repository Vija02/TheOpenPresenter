import type { AiTurn, ChatMessage } from "@repo/base-types";

/** Every layout agent takes the same turn shape. */
export type LayoutAiTurn = AiTurn;

export type BuildAgentMessagesArgs = {
  systemPrompt: string;
  request: string;
  history?: AiTurn[];
  imageDataUrl?: string | null;
  /** Extra lines placed before "Request:" (e.g. image or current-view context). */
  leadIn?: (string | null | undefined)[];
};

/**
 * Assembles the [system, ...history, user] message array shared by every layout
 * agent, attaching the reference image to the user turn when one is given.
 */
export const buildAgentMessages = ({
  systemPrompt,
  request,
  history = [],
  imageDataUrl,
  leadIn = [],
}: BuildAgentMessagesArgs): ChatMessage[] => {
  const text = [...leadIn, `Request: ${request}`]
    .filter((line): line is string => !!line && line.trim() !== "")
    .join("\n\n");

  return [
    { role: "system", content: systemPrompt },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    {
      role: "user",
      content: imageDataUrl
        ? [
            { type: "text" as const, text },
            { type: "image_url" as const, image_url: { url: imageDataUrl } },
          ]
        : text,
    },
  ];
};
