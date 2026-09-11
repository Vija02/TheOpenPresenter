import { useEffect, useState } from "react";

import { invoke } from "../bridge/ipc";
import { type Screen, getRootUrl, getScreen } from "../utils/config";

type State =
  | { status: "loading" }
  | { status: "waiting"; attempt: number }
  | { status: "paired"; screen: Screen }
  | { status: "unpaired" }
  | { status: "error"; message: string };

const HOST_RETRY_MS = 3000;

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export function MainScreen() {
  const rootUrl = getRootUrl();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!rootUrl) {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No server URL configured. Set one from the login screen.",
          });
        }
        return;
      }

      for (let attempt = 1; !cancelled; attempt++) {
        try {
          const screen = await getScreen();
          if (cancelled) return;

          if (!screen) {
            setState({ status: "unpaired" });
            return;
          }

          const reachable = await invoke<boolean>("check_host", {
            url: rootUrl,
          }).catch(() => false);
          if (cancelled) return;

          if (reachable) {
            setState({ status: "paired", screen });
            return;
          }
        } catch {
          if (cancelled) return;
        }

        setState({ status: "waiting", attempt });
        await sleep(HOST_RETRY_MS);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rootUrl]);

  useEffect(() => {
    if (state.status !== "paired") return;
    const src = `${rootUrl}/render/s/${state.screen.orgSlug}/${state.screen.screenSlug}`;
    window.location.replace(src);
  }, [state, rootUrl]);

  if (state.status === "waiting") {
    return (
      <div className="screen-loading">
        <span>
          Waiting for {rootUrl}… (attempt {state.attempt})
        </span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="screen-loading">
        <span>{state.message}</span>
      </div>
    );
  }

  if (state.status === "unpaired") {
    return (
      <div className="screen-loading">
        <span>Not paired — open Settings to scan the QR code.</span>
      </div>
    );
  }

  return (
    <div className="screen-loading">
      <span>Loading screen…</span>
    </div>
  );
}
