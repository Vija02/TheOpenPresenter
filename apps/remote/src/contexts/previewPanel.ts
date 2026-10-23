import { createStore, useStore } from "zustand";
import { persist } from "zustand/middleware";

export type PreviewPanelSource = "sidebar" | "no_output_hint";

export type PreviewPanelState = {
  isOpen: boolean;
  outputId: string | null;
  source: PreviewPanelSource | null;
  open: (source: PreviewPanelSource) => void;
  close: () => void;
  toggle: (source: PreviewPanelSource) => void;
  setOutputId: (outputId: string | null) => void;
};

export const previewPanelStore = createStore<PreviewPanelState>()(
  persist(
    (set) => ({
      // Open by default
      isOpen: true,
      outputId: null,
      source: null,
      open: (source) => set(() => ({ isOpen: true, source })),
      close: () => set(() => ({ isOpen: false })),
      toggle: (source) =>
        set((state) =>
          state.isOpen ? { isOpen: false } : { isOpen: true, source },
        ),
      setOutputId: (outputId) => set(() => ({ outputId })),
    }),
    {
      name: "remote-preview-panel",
      partialize: (state) => ({
        isOpen: state.isOpen,
        outputId: state.outputId,
      }),
    },
  ),
);

export const usePreviewPanel = () => useStore(previewPanelStore);
