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
  renderer: {
    useData: <Y = any>(fn?: (x: any) => Y) => Y;
    useValtioData: <O = undefined>() => O extends undefined ? any : O;
  };
};
