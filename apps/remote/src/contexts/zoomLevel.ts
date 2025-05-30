import { ZoomLevelState } from "@repo/base-plugin";
import { createStore } from "zustand/vanilla";

export const zoomLevelStore = createStore<ZoomLevelState>((set) => ({
  zoomLevel: 0.18,
  setZoomLevel: (newLevel: number) => set(() => ({ zoomLevel: newLevel })),
}));
