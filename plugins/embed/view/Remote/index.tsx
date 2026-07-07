import { Button, Input, PluginScaffold } from "@repo/ui";
import { useCallback, useState } from "react";

import { usePluginAPI } from "../pluginApi";

const Remote = () => {
  const pluginApi = usePluginAPI();

  const url = pluginApi.scene.useData((x) => x.pluginData.url);

  const [input, setInput] = useState(url);

  const mutableSceneData = pluginApi.scene.useValtioData();

  const onClick = useCallback(() => {
    mutableSceneData.pluginData.url = input;
  }, [input, mutableSceneData]);

  const onView = useCallback(() => {
    pluginApi.renderer.setRenderCurrentScene();
  }, [pluginApi.renderer]);

  return (
    <PluginScaffold
      title="Embed"
      body={
        <div className="stack-col items-stretch p-3 w-full gap-2">
          <p className="font-bold">Embed URL</p>

          <div className="stack-row gap-2 items-center">
            <Input
              value={input ?? ""}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter your URL..."
              className="flex-1 max-w-[500px]"
            />

            <Button onClick={onClick}>Load URL</Button>
          </div>

          <Button onClick={onView}>Open in view</Button>

          <p className="mt-2 opacity-70 text-sm">
            {url ? `Currently loaded: ${url}` : "No URL loaded"}
          </p>
        </div>
      }
    />
  );
};

export default Remote;
