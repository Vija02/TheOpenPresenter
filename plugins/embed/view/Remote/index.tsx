import { Button, Input, PluginScaffold } from "@repo/ui";
import { useCallback, useState } from "react";

import { usePluginAPI } from "../pluginApi";
import "./index.css";

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
        <div className="stack-col items-stretch p-3 w-full">
          <p className="font-bold">Embed URL</p>
          <Input
            value={input ?? ""}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your url..."
          />
          <div className="stack-row">
            <Button onClick={onClick}>Load/Save URL</Button>
            <Button onClick={onView}>Open in view</Button>
          </div>
        </div>
      }
    />
  );
};

export default Remote;
