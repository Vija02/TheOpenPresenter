import { useEffect, useState } from "react";

import {
  type RuntimeUpdateState,
  type UpdateState,
  api,
  listen,
} from "../bridge/ipc";

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

/** The runtime update state, likewise. */
export function useRuntimeUpdateState() {
  const [state, setState] = useState<RuntimeUpdateState>({ status: "none" });

  useEffect(() => {
    api
      .runtimeUpdateState()
      .then(setState)
      .catch(() => undefined);
    return listen<RuntimeUpdateState>("update:runtime", setState);
  }, []);

  return state;
}
