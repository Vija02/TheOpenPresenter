import { Button, Input, PluginScaffold } from "@repo/ui";
import { useCallback, useState } from "react";

import { usePluginAPI } from "../pluginApi";
import "./index.css";

const Remote = () => {
  const pluginApi = usePluginAPI();

  const url = pluginApi.scene.useData((x) => x.pluginData.url);

  const [input, setInput] = useState(url);

  const mutableSceneData = pluginApi.scene.useValtioData();

  const currentScene = pluginApi.renderer.useCurrentScene();
  const sceneIsShowing = pluginApi.pluginContext.sceneId === currentScene;

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
        <div className="stack-col items-stretch p-3 w-full gap-2">
          <p className="font-bold">Embed URL</p>

          <div className="stack-row gap-2 items-center">
            <Input
              value={input ?? ""}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter your url..."
              className="flex-1 max-w-[500px]"
            />

            <Button onClick={onClick}>Load URL</Button>
          </div>

          <Button
            onClick={onView}
            size="sm"
            className="stack-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs"
          >
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                sceneIsShowing ? "bg-red-500" : "bg-gray-400"
              }`}
            />
            <span>{sceneIsShowing ? "Showing" : "Open in view"}</span>
          </Button>

          <p className="mt-2 opacity-70 text-sm">
            {url ? `Currently loaded: ${url}` : "No URL loaded"}
          </p>
        </div>
      }
    />
  );
};

export default Remote;
