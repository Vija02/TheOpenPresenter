import { createStore, useStore } from "zustand";

export type RendererSelectionState = {
  selectedRendererId: string;
  setSelectedRendererId: (rendererId: string) => void;
};

export const rendererSelectionStore = createStore<RendererSelectionState>(
  (set) => ({
    selectedRendererId: "1",
    setSelectedRendererId: (rendererId: string) =>
      set(() => ({ selectedRendererId: rendererId })),
  }),
);

export const useRendererSelection = () => useStore(rendererSelectionStore);
