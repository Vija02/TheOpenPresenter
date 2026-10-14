import { Outputs } from "@repo/layout";
import { useReadOutputs } from "@repo/layout/react";
import { useData, usePluginData } from "@repo/shared";
import { useCallback } from "react";

export const useOutputs = () => {
  const data = useData();
  const mainState = usePluginData().mainState!;

  const outputs = useReadOutputs({
    renderer: data.renderer,
    outputs: data.outputs,
  });

  const writableOutputs = useCallback((): Outputs => {
    if (!mainState.outputs || Object.keys(mainState.outputs).length === 0) {
      // Through JSON: valtio-yjs can't take undefined
      mainState.outputs = JSON.parse(JSON.stringify(outputs));
    }
    return mainState.outputs as Outputs;
  }, [mainState, outputs]);

  return { outputs, writableOutputs };
};
