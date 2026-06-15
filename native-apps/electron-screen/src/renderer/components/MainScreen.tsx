import { useEffect, useState } from "react";

import { type Screen, getRootUrl, getScreen } from "../utils/config";

type State =
  | { status: "loading" }
  | { status: "paired"; screen: Screen }
  | { status: "unpaired" }
  | { status: "error"; message: string };

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
      try {
        const screen = await getScreen();
        if (cancelled) return;
        if (screen) {
          setState({ status: "paired", screen });
        } else {
          setState({ status: "unpaired" });
        }
      } catch (e) {
        if (cancelled) return;
        setState({ status: "error", message: String(e) });
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

  if (state.status === "paired" || state.status === "loading") {
    return (
      <div className="screen-loading">
        <span>Loading screen…</span>
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

  return (
    <div className="screen-loading">
      <span>Not paired — open Settings to scan the QR code.</span>
    </div>
  );
}
