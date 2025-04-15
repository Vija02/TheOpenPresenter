import { useQuery } from "@tanstack/react-query";
import { availableMonitors } from "@tauri-apps/api/window";

export const useAvailableMonitors = () => {
  return useQuery({
    queryKey: ["availableMonitors"],
    queryFn: () => {
      return availableMonitors();
    },
  });
};
