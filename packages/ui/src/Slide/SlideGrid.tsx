import { Grid } from "@chakra-ui/react";
import { PluginAPIContext } from "@repo/base-plugin/client";
import { createContext, useContext, useMemo } from "react";
import { useStore } from "zustand";

type PropTypes = {
  children?: React.ReactNode;
  forceWidth?: number;
};

export const SlideGrid = ({ children, forceWidth }: PropTypes) => {
  const val = useContext(PluginAPIContext);
  const { zoomLevel } = val.pluginAPI
    ? useStore(val.pluginAPI.remote.zoomLevel)
    : { zoomLevel: 0.5 };

  const pixelValue = useMemo(
    () => (forceWidth ? forceWidth : zoomLevel * 400),
    [forceWidth, zoomLevel],
  );

  return (
    <CustomSizeContext.Provider value={{ forceWidth }}>
      <Grid
        gap={3}
        gridTemplateColumns={`repeat(auto-fill, minmax(${pixelValue}px, 1fr))`}
      >
        {children}
      </Grid>
    </CustomSizeContext.Provider>
  );
};

export const CustomSizeContext = createContext<{
  forceWidth?: number | undefined;
}>({});
