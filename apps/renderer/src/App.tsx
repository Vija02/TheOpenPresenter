import {
  AudioCheckProvider,
  AwarenessProvider,
  ErrorProvider,
  PluginDataProvider,
  PluginMetaDataProvider,
} from "@repo/shared";
import { useHandleKeyPress } from "@repo/shared";
import { lazy, useEffect } from "react";
import { Route, Switch, useParams } from "wouter";

import { Body } from "./Body";

const TauriHandler = lazy(() => import("./TauriHandler"));

function App() {
  return (
    <Switch>
      <Route nest path="/:orgSlug/:projectSlug" component={Root} />
      <Route component={RedirectToOrg} />
    </Switch>
  );
}

export default App;

function Root() {
  const params = useParams();

  const { orgSlug, projectSlug } = params;

  return (
    <PluginMetaDataProvider
      orgSlug={orgSlug!}
      projectSlug={projectSlug!}
      type="renderer"
    >
      <ErrorProvider>
        <AudioCheckProvider>
          <PluginDataProvider type="renderer">
            <AwarenessProvider>
              <Inner />
            </AwarenessProvider>
          </PluginDataProvider>
        </AudioCheckProvider>
      </ErrorProvider>
    </PluginMetaDataProvider>
  );
}

const Inner = () => {
  const handleKeyPress = useHandleKeyPress();

  return (
    <div
      style={{ width: "100vw", height: "100vh" }}
      tabIndex={0}
      onKeyDown={handleKeyPress}
    >
      {window.__TAURI_INTERNALS__ ? (
        <TauriHandler>
          <Body />
        </TauriHandler>
      ) : (
        <Body />
      )}
    </div>
  );
};

function RedirectToOrg() {
  useEffect(() => {
    window.location.href = "/o";
  }, []);

  return <p>Redirecting...</p>;
}
