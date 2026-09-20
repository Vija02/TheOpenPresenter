import { FeedSourceResolver, resolveFeedSources } from "@repo/layout/react";
import { useData } from "@repo/shared";
import { useCallback } from "react";

/** Resolves a feed's plugins against the project state this remote holds. */
export const useFeedSourceResolver = (): FeedSourceResolver => {
  const data = useData();

  return useCallback((feed) => resolveFeedSources(data, feed), [data]);
};
