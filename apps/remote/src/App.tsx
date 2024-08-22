import { Box, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { Route, Switch, useParams } from "wouter";

import MainBody from "./containers/MainBody";
import Sidebar from "./containers/Sidebar";
import { PluginDataProvider } from "./contexts/PluginDataProvider";
import { PluginMetaDataProvider } from "./contexts/PluginMetaDataProvider";

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
    <PluginMetaDataProvider orgSlug={orgSlug!} projectSlug={projectSlug!}>
      <PluginDataProvider>
        <Box
          display="flex"
          position="relative"
          height="100vh"
          overflow="hidden"
        >
          <Sidebar />
          <MainBody />
        </Box>
      </PluginDataProvider>
    </PluginMetaDataProvider>
  );
}

function RedirectToOrg() {
  useEffect(() => {
    window.location.href = "/o";
  }, []);

  return <Text>Redirecting...</Text>;
}
