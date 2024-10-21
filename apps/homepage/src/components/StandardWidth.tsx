import { Box, BoxProps } from "@/styled-system/jsx";
import React from "react";

type PropTypes = BoxProps & { customMaxWidth?: BoxProps["maxWidth"] };

export const StandardWidth = React.forwardRef<HTMLDivElement, PropTypes>(
  ({ customMaxWidth, children, ...rest }, ref) => {
    return (
      <Box ref={ref} display="flex" flexDir="column" height="100%" {...rest}>
        <Box
          marginX="auto"
          width="100%"
          maxWidth={customMaxWidth ?? "1200px"}
          paddingX={5}
          paddingY={5}
        >
          {children}
        </Box>
      </Box>
    );
  },
);

StandardWidth.displayName = "StandardWidth";
