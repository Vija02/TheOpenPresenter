import type { StoreApi } from "zustand";

export type ZoomLevelState = {
  zoomLevel: number;
  setZoomLevel: (val: number) => void;
};

export type ZoomLevel = StoreApi<ZoomLevelState>;

export type PluginAPI = {
  remote: {
    zoomLevel: ZoomLevel;
  };
};
