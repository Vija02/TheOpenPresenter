import { useDeviceType } from "@/lib/DeviceType";
import { useBreakpointValue } from "@chakra-ui/react";

export const useIsMobile = () => {
  const deviceType = useDeviceType();

  return useBreakpointValue(
    { base: true, md: false },
    { fallback: deviceType === "mobile" ? "base" : "md" },
  );
};
