import {
  AiChatRequest,
  createAiCapabilityRequest,
  useAiChat,
} from "@repo/ai-chat";
import { useCallback, useMemo } from "react";

import { Plugin } from "./types";

type SourceDoc = { files: Record<string, string> };

export const usePluginSourceAi = ({
  plugin,
  organizationId,
  files,
  setFiles,
}: {
  plugin: Plugin;
  organizationId: string;
  files: Record<string, string>;
  setFiles: (
    update: (prev: Record<string, string>) => Record<string, string>,
  ) => void;
}) => {
  const doc = useMemo<SourceDoc>(() => ({ files }), [files]);

  const onChange = useCallback(
    (next: SourceDoc) => setFiles(() => next.files),
    [setFiles],
  );

  const onRequest = useMemo<AiChatRequest<SourceDoc>>(
    () =>
      createAiCapabilityRequest<SourceDoc>({
        capability: "plugin-source",
        organizationId,
      }),
    [organizationId],
  );

  return useAiChat<SourceDoc>({
    doc,
    onChange,
    onRequest,
    threadKey: `cplugin-source:${plugin.id}`,
    organizationId,
  });
};
