import {
  AudioCheckProvider,
  AwarenessProvider,
  ErrorProvider,
  PluginDataProvider,
  PluginMetaDataProvider,
} from "@repo/shared";
import { useEffect } from "react";
import { Route, Switch, useParams } from "wouter";

import MainBody from "./containers/MainBody";
import Sidebar from "./containers/Sidebar";

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
      type="remote"
    >
      <ErrorProvider>
        <AudioCheckProvider>
          <PluginDataProvider type="remote">
            <AwarenessProvider>
              <div className="flex relative h-screen overflow-hidden">
                <Sidebar />
                <MainBody />
              </div>
            </AwarenessProvider>
          </PluginDataProvider>
        </AudioCheckProvider>
      </ErrorProvider>
    </PluginMetaDataProvider>
  );
}

function RedirectToOrg() {
  useEffect(() => {
    window.location.href = "/o";
  }, []);

  return <p>Redirecting...</p>;
}
