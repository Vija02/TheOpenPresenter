import { MediaPickerProvider } from "@repo/base-plugin/client";
import {
  AudioCheckProvider,
  AwarenessProvider,
  ErrorProvider,
  PluginDataProvider,
  PluginMetaDataProvider,
  useHandleKeyPress,
} from "@repo/shared";
import { useEffect } from "react";
import { Route, Switch, useParams } from "wouter";

import "./App.css";
import CentralContainer from "./containers/CentralContainer";
import { TopBar } from "./containers/TopBar";
import { useRendererSelection } from "./contexts/rendererSelection";

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
  const { selectedRendererId } = useRendererSelection();

  const { orgSlug, projectSlug } = params;

  return (
    <PluginMetaDataProvider
      orgSlug={orgSlug!}
      projectSlug={projectSlug!}
      type="remote"
    >
      <ErrorProvider>
        <AudioCheckProvider>
          <PluginDataProvider type="remote" rendererId={selectedRendererId}>
            <AwarenessProvider>
              <MediaPickerWrapper>
                <Inner />
              </MediaPickerWrapper>
            </AwarenessProvider>
          </PluginDataProvider>
        </AudioCheckProvider>
      </ErrorProvider>
    </PluginMetaDataProvider>
  );
}

function MediaPickerWrapper({ children }: { children: React.ReactNode }) {
  return <MediaPickerProvider>{children}</MediaPickerProvider>;
}

const Inner = () => {
  const handleKeyPress = useHandleKeyPress();

  return (
    <div className="rt--app" tabIndex={0} onKeyDown={handleKeyPress}>
      <TopBar />
      <CentralContainer />
    </div>
  );
};

function RedirectToOrg() {
  useEffect(() => {
    window.location.href = "/o";
  }, []);

  return <p>Redirecting...</p>;
}
