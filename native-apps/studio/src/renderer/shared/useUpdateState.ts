import { useEffect, useState } from "react";

import { type UpdateState, api, listen } from "../bridge/ipc";

/** The app update state, kept current by the main process. */
export function useUpdateState() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

  useEffect(() => {
    api
      .updateState()
      .then(setState)
      .catch(() => undefined);
    // The main process drives the download, so progress arrives as events
    // rather than from polling.
    return listen<UpdateState>("update:state", setState);
  }, []);

  return [state, setState] as const;
}
