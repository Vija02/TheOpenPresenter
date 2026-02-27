import { useCallback } from "react";
import { useLocation, useSearch } from "wouter";

/**
 * A navigation hook that preserves query parameters
 */
export const useNavigateWithParams = () => {
  const [, navigate] = useLocation();
  const search = useSearch();

  const navigateWithParams = useCallback(
    (path: string, options?: { replace?: boolean }) => {
      const newPath = search ? `${path}?${search}` : path;
      navigate(newPath, options);
    },
    [navigate, search],
  );

  return navigateWithParams;
};
