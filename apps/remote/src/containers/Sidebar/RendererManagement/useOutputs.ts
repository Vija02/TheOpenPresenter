import { MAIN_LOOK_KEY } from "@repo/base-plugin";
import {
  LayoutDoc,
  Output,
  Outputs,
  cloneDoc,
  setHostLook,
} from "@repo/layout";
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

/** Every look an output's boxes show */
export const outputLookKeys = (output: Output): string[] =>
  output.layout.elements.flatMap((element) =>
    element.type === "host" ? [element.look ?? MAIN_LOOK_KEY] : [],
  );

/** Outputs showing a look, by name */
export const outputsUsingLook = (outputs: Outputs, lookKey: string): string[] =>
  Object.values(outputs)
    .filter((output) => outputLookKeys(output).includes(lookKey))
    .map((output) => output.name);

export const useOutputActions = () => {
  const { writableOutputs } = useOutputs();

  const editLayout = useCallback(
    (outputId: string, edit: (layout: LayoutDoc) => LayoutDoc) => {
      const target = writableOutputs()[outputId];
      if (!target) return;
      target.layout = cloneDoc(edit(cloneDoc(target.layout)));
    },
    [writableOutputs],
  );

  const setLook = useCallback(
    (outputId: string, boxId: string, lookKey: string) =>
      editLayout(outputId, (layout) =>
        setHostLook(layout, boxId, lookKey === MAIN_LOOK_KEY ? null : lookKey),
      ),
    [editLayout],
  );

  const rename = useCallback(
    (outputId: string, name: string) => {
      const target = writableOutputs()[outputId];
      if (target) target.name = name;
    },
    [writableOutputs],
  );

  const deleteOutput = useCallback(
    (outputId: string) => {
      delete writableOutputs()[outputId];
    },
    [writableOutputs],
  );

  return { editLayout, setLook, rename, deleteOutput };
};
