import { useData } from "@repo/shared";
import { useCallback } from "react";

import { OUTPUT_KINDS, outputKind } from "../RendererManagement/outputKinds";
import { useOutputs } from "../RendererManagement/useOutputs";

export const useOutputName = () => {
  const data = useData();
  const { outputs } = useOutputs();

  return useCallback(
    (outputId: string) => {
      const output = outputs[outputId];
      if (!output) return OUTPUT_KINDS.main.title;
      return output.name || OUTPUT_KINDS[outputKind(data.looks, output)].title;
    },
    [data.looks, outputs],
  );
};
