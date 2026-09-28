import { desktop } from "@repo/desktop-bridge";
import { useQuery } from "@tanstack/react-query";

/** Renderer ids currently presenting, so the UI can offer "stop presenting". */
export const usePresentingRenderers = () => {
  return useQuery({
    queryKey: ["presentingRenderers"],
    queryFn: () => desktop.listPresenting(),
  });
};
