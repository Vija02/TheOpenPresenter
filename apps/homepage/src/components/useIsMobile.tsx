import { useBreakpointValue } from "@chakra-ui/react";
import { isMobile as mobile } from "is-mobile";

export const useIsMobile = () => {
  return useBreakpointValue(
    { base: true, md: false },
    { fallback: mobile() ? "base" : "md" },
  );
};
