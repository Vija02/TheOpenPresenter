import type { AwarenessState, AwarenessStateData } from "@repo/base-plugin";
import { produce } from "immer";
import { create } from "zustand";

type State = {
  awarenessState: AwarenessState;
  setAwarenessState: (
    sceneId: string,
    pluginId: string,
    state: AwarenessStateData,
  ) => void;
};
export const useAwarenessState = create<State>((set) => ({
  awarenessState: [],
  setAwarenessState: (sceneId, pluginId, newState) =>
    set((prev) => {
      const foundIndex = prev.awarenessState.findIndex(
        (x) => x.pluginId === pluginId && x.sceneId === sceneId,
      );
      if (foundIndex > -1) {
        return produce(prev, (draft) => {
          draft.awarenessState[foundIndex] = {
            ...draft.awarenessState[foundIndex],
            ...newState,
          };
        });
      }

      return produce(prev, (draft) => {
        draft.awarenessState.push({
          sceneId,
          pluginId,
          ...newState,
        });
      });
    }),
}));
