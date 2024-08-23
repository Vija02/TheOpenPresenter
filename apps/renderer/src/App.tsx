import { Box, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { Route, Switch, useParams } from "wouter";

import { Body } from "./Body";
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
        <Box w="100vw" h="100vh">
          <Body />
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
