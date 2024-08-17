import { useState } from "react";

import { useIsomorphicLayoutEffect } from "./useIsomorphicLayoutEffect";

// Usage:
// const key = useInitialLoad()
// <Component
//  key={key}
// >
// This is to force the component to render again (Layout blocking) when the app first loaded.
// Used because of SSR not having enough information, yet it is fast enough to query in the frontend
export function useInitialLoad() {
  const [initialLoad, setInitialLoad] = useState(false);
  useIsomorphicLayoutEffect(() => {
    setInitialLoad(true);
  }, []);

  return initialLoad.toString();
}
