import { desktop } from "@repo/desktop-bridge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const QUERY_KEY = ["presentingRenderers"];

/** Renderer ids currently presenting, so the UI can offer "stop presenting". */
export const usePresentingRenderers = () => {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      desktop.onPresentingChanged((rendererIds) => {
        queryClient.setQueryData(QUERY_KEY, rendererIds);
      }),
    [queryClient],
  );

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => desktop.listPresenting(),
  });
};
