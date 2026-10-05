import { desktop } from "@repo/desktop-bridge";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export const useAvailableMonitors = () => {
  const query = useQuery({
    queryKey: ["availableMonitors"],
    queryFn: () => desktop.listMonitors(),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { refetch } = query;
  useEffect(
    () =>
      desktop.onMonitorsChanged(() => {
        void refetch();
      }),
    [refetch],
  );

  return query;
};
