import { useMediaQuery } from "@chakra-ui/react";

import { useInitialLoad } from "./useInitialLoad";

export function useIsMobile(): boolean | null {
  // Make sure we re-render this after client load
  const key = useInitialLoad();

  const [isMobile] = useMediaQuery("(max-width: 760px)");

  return key === "true" ? (isMobile ? isMobile : false) : null;
}
