import type { AwarenessUserData } from "./types";

/** A renderer on an actual screen, leaving out remotes' previews */
export const isScreenRenderer = (user: AwarenessUserData | null | undefined) =>
  user?.type === "renderer" && !user.isPreview;
