import { createStore, useStore } from "zustand";

/** What made the preview open. Reported to analytics. */
export type PreviewWindowSource = "sidebar" | "no_output_hint";

export type PreviewWindowState = {
  isOpen: boolean;
  source: PreviewWindowSource | null;
  open: (source: PreviewWindowSource) => void;
  close: () => void;
  toggle: (source: PreviewWindowSource) => void;
};

export const previewWindowStore = createStore<PreviewWindowState>((set) => ({
  isOpen: false,
  source: null,
  open: (source) => set(() => ({ isOpen: true, source })),
  close: () => set(() => ({ isOpen: false })),
  toggle: (source) =>
    set((state) =>
      state.isOpen ? { isOpen: false } : { isOpen: true, source },
    ),
}));

export const usePreviewWindow = () => useStore(previewWindowStore);
