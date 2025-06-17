import useSize from "@react-hook/size";
import { PluginAPIContext } from "@repo/base-plugin/client";
import { createContext, useContext, useMemo, useRef } from "react";
import { useStore } from "zustand";

import { mapZoomToRange } from "./mapZoomToRange";

type PropTypes = {
  children?: React.ReactNode;
  forceWidth?: number;
};

export const SlideGrid = ({ children, forceWidth }: PropTypes) => {
  const target = useRef<any>(null);
  const [width] = useSize(target);

  const val = useContext(PluginAPIContext);
  const { zoomLevel } = val.pluginAPI
    ? // Breaks the rule of hook, but this should be a one time condition
      useStore(val.pluginAPI.remote.zoomLevel)
    : { zoomLevel: 0.5 };

  const pixelValue = useMemo(
    () => (forceWidth ? forceWidth : mapZoomToRange(zoomLevel, width)),
    [forceWidth, width, zoomLevel],
  );

  return (
    <CustomSizeContext.Provider value={{ forceWidth, containerWidth: width }}>
      <div
        className="grid gap-3"
        ref={target}
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${pixelValue}px, 1fr))`,
        }}
      >
        {children}
      </div>
    </CustomSizeContext.Provider>
  );
};

export const CustomSizeContext = createContext<{
  forceWidth?: number | undefined;
  containerWidth: number;
}>({ containerWidth: typeof window !== "undefined" ? window.innerWidth : 0 });
