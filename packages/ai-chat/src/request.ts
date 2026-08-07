import { appData, readSseEvents } from "@repo/lib";

import type { AiChatRequest, AiChatStep } from "./useAiChat";

export type AiCapabilityRequestOptions = {
  capability: string;
  extraBody?: Record<string, unknown>;
};

const messageForStatus = (status: number): string => {
  switch (status) {
    case 401:
      return "Your session expired. Reload and sign in again.";
    case 404:
      return "That AI feature is not available on this server.";
    case 413:
      return "That request was too large. Try a smaller file.";
    default:
      return `The AI request failed (${status}).`;
  }
};

/**
 * An `AiChatRequest` for one capability, ready to hand to `useAiChat` or
 * `LayoutWorkbench`.
 */
export const createAiCapabilityRequest = <TDoc>({
  capability,
  extraBody,
}: AiCapabilityRequestOptions): AiChatRequest<TDoc> => {
  return async ({ request, doc, history, image, signal, onStep }) => {
    const res = await fetch(`${window.location.origin}/ai/${capability}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "csrf-token": appData.getCSRFToken(),
        ...appData.getProxyConfig().headers,
      },
      body: JSON.stringify({ ...extraBody, doc, request, history, image }),
      signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(messageForStatus(res.status));
    }

    for await (const event of readSseEvents(res.body, { signal })) {
      let step: AiChatStep<TDoc>;
      try {
        step = JSON.parse(event.data);
      } catch {
        continue;
      }
      onStep(step);
    }
  };
};
