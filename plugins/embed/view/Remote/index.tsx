import { Button, FormLabel, Input, Stack } from "@chakra-ui/react";
import { PluginScaffold } from "@repo/ui";
import { useCallback, useState } from "react";

import { usePluginAPI } from "../pluginApi";

const Remote = () => {
  const pluginApi = usePluginAPI();

  const url = pluginApi.scene.useData((x) => x.pluginData.url);
  const [input, setInput] = useState(url);

  const mutableSceneData = pluginApi.scene.useValtioData();

  const onClick = useCallback(async () => {
    mutableSceneData.pluginData.url = input;
  }, [input, mutableSceneData.pluginData]);

  const onView = useCallback(() => {
    pluginApi.renderer.setRenderCurrentScene();
  }, [pluginApi.renderer]);

  return (
    <PluginScaffold
      title="Embed"
      body={
        <Stack direction="column" p={3} width="100%">
          <FormLabel fontWeight="bold">Embed URL</FormLabel>
          <Input
            value={input ?? ""}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your url..."
          />
          <Stack direction="row">
            <Button onClick={onClick}>Load/Save URL</Button>
            <Button onClick={onView}>Open in view</Button>
          </Stack>
        </Stack>
      }
    />
  );
};

export default Remote;
