import { Box, Text } from "@chakra-ui/react";
import { PluginAPIContext } from "@repo/base-plugin/client";
import { use, useContext } from "react";
import { useStore } from "zustand";

import { CustomSizeContext } from "./SlideGrid";
import { mapZoomToRange } from "./mapZoomToRange";

type PropTypes = {
  heading?: string;
  headingIsFaded?: boolean;
  isActive?: boolean;
  aspectRatio?: number;
  onClick?: () => void;
  children?: React.ReactNode;
};

export const Slide = ({
  heading,
  headingIsFaded,
  isActive,
  aspectRatio = 16 / 9,
  onClick,
  children,
}: PropTypes) => {
  const { forceWidth, containerWidth } = use(CustomSizeContext);
  const val = useContext(PluginAPIContext);
  const { zoomLevel } = val.pluginAPI
    ? // Breaks the rule of hook, but this should be a one time condition
      useStore(val.pluginAPI.remote.zoomLevel)
    : { zoomLevel: 0.5 };

  return (
    <Box
      display="flex"
      justifyContent="center"
      cursor={onClick ? "pointer" : "auto"}
      onClick={onClick}
    >
      <Box overflow="hidden">
        {heading && (
          <Text
            fontWeight={headingIsFaded ? "normal" : "bold"}
            textTransform="uppercase"
            fontSize="xs"
            mb={1}
            color={headingIsFaded ? "gray.600" : "inherit"}
            textOverflow="ellipsis"
            overflow="hidden"
            whiteSpace="nowrap"
          >
            {heading}
          </Text>
        )}
        <Box
          aspectRatio={aspectRatio}
          w={
            forceWidth
              ? `${forceWidth}px`
              : `${mapZoomToRange(zoomLevel, containerWidth)}px`
          }
          borderWidth="4px"
          borderColor={isActive ? "red.600" : "transparent"}
          userSelect="none"
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};
