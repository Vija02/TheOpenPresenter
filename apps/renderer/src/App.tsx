import { desktop } from "@repo/desktop-bridge";
import { outputProgramId } from "@repo/layout";
import { useReadOutputs } from "@repo/layout/react";
import { detectWebPSupport } from "@repo/lib";
import {
  AudioCheckProvider,
  AwarenessProvider,
  ErrorProvider,
  PluginDataProvider,
  PluginMetaDataProvider,
} from "@repo/shared";
import { useData, useHandleKeyPress, usePluginData } from "@repo/shared";
import { lazy, useEffect, useMemo } from "react";
import { Route, Switch, useParams, useSearch } from "wouter";

import { Body } from "./Body";
import { FullscreenButton } from "./FullscreenButton";
import { Screen } from "./Screen";

void detectWebPSupport();

const DesktopHandler = lazy(() => import("./DesktopHandler"));

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

  // When passed, we draw only that hostElement rather than the layout/confidence monitor
  const hostElementId = useMemo(() => {
    const searchParams = new URLSearchParams(search);
    return searchParams.get("hostElement");
  }, [search]);

  // Used for looks preview before it's finalized, so we pass the raw spec
  const hostSpec = useMemo(() => {
    const searchParams = new URLSearchParams(search);
    return searchParams.get("hostSpec");
  }, [search]);

  useEffect(() => {
    if (!hostElementId && !hostSpec) return;

    const { documentElement, body } = document;
    documentElement.style.backgroundColor = "transparent";
    body.style.backgroundColor = "transparent";

    return () => {
      documentElement.style.backgroundColor = "";
      body.style.backgroundColor = "";
    };
  }, [hostElementId, hostSpec]);

  return (
    <PluginMetaDataProvider
      orgSlug={orgSlug!}
      projectSlug={projectSlug!}
      type="renderer"
    >
      <ErrorProvider>
        <AudioCheckProvider>
          <PluginDataProvider
            type="renderer"
            rendererId={rendererId}
            isPreview={isPreview}
          >
            <AwarenessProvider>
              <AppInner
                hideFullscreenButton={
                  isPreview || !!hostElementId || !!hostSpec
                }
                hostElementId={hostElementId}
                hostSpec={hostSpec}
              />
            </AwarenessProvider>
          </PluginDataProvider>
        </AudioCheckProvider>
      </ErrorProvider>
    </PluginMetaDataProvider>
  );
}

export const AppInner = ({
  hideFullscreenButton,
  hostElementId = null,
  hostSpec = null,
}: {
  hideFullscreenButton?: boolean;
  hostElementId?: string | null;
  hostSpec?: string | null;
}) => {
  const data = useData();
  const outputId = usePluginData().rendererId;
  const outputs = useReadOutputs({
    renderer: data.renderer,
    outputs: data.outputs,
  });
  const handleKeyPress = useHandleKeyPress(outputProgramId(outputs, outputId));

  return (
    <div
      style={{ width: "100vw", height: "100dvh" }}
      tabIndex={0}
      onKeyDown={handleKeyPress}
    >
      {desktop.isDesktop ? (
        <DesktopHandler>
          <Body hostElementId={hostElementId} hostSpec={hostSpec} />
        </DesktopHandler>
      ) : (
        <>
          <Body hostElementId={hostElementId} hostSpec={hostSpec} />
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
