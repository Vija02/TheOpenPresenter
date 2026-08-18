import { AiChatRequest, createAiCapabilityRequest, useAiChat } from "@repo/ai-chat";
import { cloneDoc } from "@repo/layout";
import type { DeckDoc } from "@repo/layout/ai";
import { appData } from "@repo/lib";
import isEqual from "fast-deep-equal";
import { useCallback, useMemo, useRef } from "react";

import {
  isCustomImport,
  newCustomSlideId,
  rebuildOrderForDeckCount,
} from "../../../src/customSlides";
import { CustomImportData } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";

export type DeckAiOptions = {
  getContext?: () => string | null | undefined;
};

export const useDeckAi = (importId: string, options: DeckAiOptions = {}) => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);

  const doc = useMemo<DeckDoc>(() => {
    const imp = pluginData.imports?.[importId];
    const docs = imp && imp.type === "custom" ? imp.docs : null;
    return { slides: (docs ?? []).map((d) => cloneDoc(d)) };
  }, [pluginData, importId]);

  const onChange = useCallback(
    (next: DeckDoc) => {
      const pluginData = mutableSceneData.pluginData;
      const deck = pluginData.imports[importId];
      if (!isCustomImport(deck)) return;
      const target = deck as CustomImportData;

      const nextSlides = next.slides;
      const prevCount = target.docs.length;
      const nextCount = nextSlides.length;

      // Minimal in-place diff
      const limit = Math.min(prevCount, nextCount);
      for (let i = 0; i < limit; i++) {
        const nextDoc = nextSlides[i]!;
        if (!isEqual(target.docs[i], nextDoc)) {
          target.docs[i] = cloneDoc(nextDoc);
        }
      }

      if (nextCount > prevCount) {
        for (let i = prevCount; i < nextCount; i++) {
          target.docs.push(cloneDoc(nextSlides[i]!));
          target.slideIds.push(newCustomSlideId());
          target.slideClickCounts.push(0);
        }
      }

      if (nextCount < prevCount) {
        target.docs.splice(nextCount);
        target.slideIds.splice(nextCount);
        target.slideClickCounts.splice(nextCount);
      }

      // A same-length edit keeps existing refs (and the current selection).
      if (nextCount !== prevCount) {
        pluginData.slideOrder = rebuildOrderForDeckCount(
          [...pluginData.slideOrder],
          importId,
          nextCount,
        );
      }
    },
    [mutableSceneData, importId],
  );

  const getContextRef = useRef(options.getContext);
  getContextRef.current = options.getContext;

  const onRequest = useMemo<AiChatRequest<DeckDoc> | undefined>(
    () =>
      appData.getAiEnabled()
        ? createAiCapabilityRequest<DeckDoc>({
            capability: "layout-deck",
            getExtraBody: () => {
              const context = getContextRef.current?.();
              return context ? { context } : {};
            },
          })
        : undefined,
    [],
  );

  return useAiChat<DeckDoc>({
    doc,
    onChange,
    onRequest,
    threadKey: `slides-deck:${pluginApi.pluginContext.pluginId}:${importId}`,
    pluginApi,
  });
};
