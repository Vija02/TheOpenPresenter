import { Button, Input, PluginScaffold } from "@repo/ui";
import { useCallback, useState } from "react";

import { usePluginAPI } from "../pluginApi";
import "./index.css";

const Remote = () => {
  const pluginApi = usePluginAPI();

  const timerDuration = pluginApi.scene.useData(
    (x) => x.pluginData.timerDuration,
  );
  const [input, setInput] = useState((timerDuration / 1000).toString());

  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  const onSetTimer = useCallback(async () => {
    mutableSceneData.pluginData.timerDuration = parseInt(input, 10) * 1000;
    mutableRendererData.isRunning = false;
    mutableRendererData.timeStarted = null;
  }, [input, mutableRendererData, mutableSceneData.pluginData]);

  const onStartTimer = useCallback(async () => {
    mutableRendererData.isRunning = true;
    mutableRendererData.timeStarted = new Date().getTime();
  }, [mutableRendererData]);

  const onResetTimer = useCallback(async () => {
    mutableRendererData.isRunning = false;
    mutableRendererData.timeStarted = null;
  }, [mutableRendererData]);

  const onView = useCallback(() => {
    pluginApi.renderer.setRenderCurrentScene();
  }, [pluginApi.renderer]);

  return (
    <PluginScaffold
      title="Timer"
      body={
        <div className="stack-col items-start p-3 w-full">
          <p className="font-bold">Timer in seconds</p>
          <Input
            value={input ?? ""}
            onChange={(e) => setInput(e.target.value)}
            placeholder="300"
          />
          <div className="stack-row items-start flex-wrap">
            <Button onClick={onSetTimer}>Set duration</Button>
            <Button onClick={onStartTimer}>Start Timer</Button>
            <Button onClick={onResetTimer}>Reset Timer</Button>
            <Button onClick={onView}>Open in view</Button>
          </div>
        </div>
      }
    />
  );
};

export default Remote;
