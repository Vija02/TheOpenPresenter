import { createContext, useContext } from "react";

export type LayoutActiveSince = number | null;

export const LayoutActiveContext = createContext<LayoutActiveSince>(null);

/** Track when layout is active for video playback */
export const useLayoutActiveSince = (): LayoutActiveSince =>
  useContext(LayoutActiveContext);
