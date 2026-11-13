import { createStore, useStore } from "zustand";

/** "This screen": an output over the remote */
export type PresentHereState = {
  outputId: string | null;
  start: (outputId: string) => void;
  stop: () => void;
};

export const presentHereStore = createStore<PresentHereState>((set) => ({
  outputId: null,
  start: (outputId) => set(() => ({ outputId })),
  stop: () => set(() => ({ outputId: null })),
}));

export const usePresentHere = () => useStore(presentHereStore);
