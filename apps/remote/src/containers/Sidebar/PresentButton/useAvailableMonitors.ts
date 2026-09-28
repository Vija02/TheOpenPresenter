import { desktop } from "@repo/desktop-bridge";
import { useQuery } from "@tanstack/react-query";

export const useAvailableMonitors = () => {
  return useQuery({
    queryKey: ["availableMonitors"],
    queryFn: () => desktop.listMonitors(),
  });
};
