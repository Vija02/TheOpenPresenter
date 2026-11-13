import { createStore, useStore } from "zustand";

/** The display each output was last sent to. Studio doesn't say where. */
type PresentedOnState = {
  monitorNames: Record<string, string>;
  monitorKeys: Record<string, string>;
  set: (outputId: string, monitorName: string, monitorKey?: string) => void;
};

export const presentedOnStore = createStore<PresentedOnState>((set) => ({
  monitorNames: {},
  monitorKeys: {},
  set: (outputId, monitorName, monitorKey) =>
    set((state) => ({
      monitorNames: { ...state.monitorNames, [outputId]: monitorName },
      monitorKeys: monitorKey
        ? { ...state.monitorKeys, [outputId]: monitorKey }
        : state.monitorKeys,
    })),
}));

export const usePresentedOn = () =>
  useStore(presentedOnStore, (state) => state.monitorNames);

export const usePresentedOnKeys = () =>
  useStore(presentedOnStore, (state) => state.monitorKeys);
