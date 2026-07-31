import {
  AudioCheckProvider,
  AwarenessProvider,
  ErrorProvider,
  PluginDataProvider,
  PluginMetaDataProvider,
} from "@repo/shared";
import { useHandleKeyPress } from "@repo/shared";
import { lazy, useEffect, useMemo } from "react";
import { Route, Switch, useParams, useSearch } from "wouter";

import { Body } from "./Body";
import { FullscreenButton } from "./FullscreenButton";
import { Screen } from "./Screen";

const TauriHandler = lazy(() => import("./TauriHandler"));

function App() {
  return (
    <Switch>
      <Route path="/s/:orgSlug/:screenSlug" component={Screen} />
      <Route nest path="/:orgSlug/:projectSlug" component={Root} />
      <Route component={RedirectToOrg} />
    </Switch>
  );
}

export default App;

function Root() {
  const params = useParams();
  const search = useSearch();

  const { orgSlug, projectSlug } = params;

  const rendererId = useMemo(() => {
    const searchParams = new URLSearchParams(search);
    return searchParams.get("renderer") || "1";
  }, [search]);

  const isPreview = useMemo(() => {
    const searchParams = new URLSearchParams(search);
    return searchParams.get("preview") === "1";
  }, [search]);

  return (
    <PluginMetaDataProvider
      orgSlug={orgSlug!}
      projectSlug={projectSlug!}
      type="renderer"
    >
      <ErrorProvider>
        <AudioCheckProvider>
          <PluginDataProvider type="renderer" rendererId={rendererId}>
            <AwarenessProvider>
              <AppInner hideFullscreenButton={isPreview} />
            </AwarenessProvider>
          </PluginDataProvider>
        </AudioCheckProvider>
      </ErrorProvider>
    </PluginMetaDataProvider>
  );
}

export const AppInner = ({
  hideFullscreenButton,
}: {
  hideFullscreenButton?: boolean;
}) => {
  const handleKeyPress = useHandleKeyPress();

  return (
    <div
      style={{ width: "100vw", height: "100dvh" }}
      tabIndex={0}
      onKeyDown={handleKeyPress}
    >
      {window.__TAURI_INTERNALS__ ? (
        <TauriHandler>
          <Body />
        </TauriHandler>
      ) : (
        <>
          <Body />
          {!hideFullscreenButton && <FullscreenButton />}
        </>
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
