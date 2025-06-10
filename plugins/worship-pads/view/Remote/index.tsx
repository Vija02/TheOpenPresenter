import { Button, PluginScaffold, VolumeBar, cn } from "@repo/ui";
import { FaStop } from "react-icons/fa";

import { usePluginAPI } from "../pluginApi";
import "./index.css";

const WorshipPadsRemote = () => {
  const pluginApi = usePluginAPI();

  const files = pluginApi.scene.useData((x) => x.pluginData.files);
  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const volume = pluginApi.renderer.useData((x) => x.volume);
  const currentKey = pluginApi.renderer.useData((x) => x.currentKey);

  const mutableRendererData = pluginApi.renderer.useValtioData();

  return (
    <PluginScaffold
      title="Worship Pads"
      body={
        <>
          <VolumeBar
            volume={volume}
            onChange={(v) => {
              mutableRendererData.volume = v;
            }}
          />
          <div className="p-3 w-full overflow-auto">
            <div>
              <div className="grid gap-[1px] max-w-[1200px] border border-black bg-black grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {files.map((file) => (
                  <Button
                    className={cn(
                      "w-full h-full rounded-none aspect-square hover:bg-surface-primary-hover",
                      isPlaying &&
                        currentKey === file.key &&
                        "bg-surface-primary-active",
                    )}
                    variant="outline"
                    onClick={() => {
                      mutableRendererData.currentKey = file.key;
                      mutableRendererData.isPlaying = true;
                    }}
                  >
                    {file.key}
                  </Button>
                ))}
              </div>
            </div>

            {isPlaying && (
              <Button
                onClick={() => {
                  mutableRendererData.isPlaying = false;
                }}
                className="w-full mt-3"
                variant="warning"
              >
                <FaStop />
                Stop
              </Button>
            )}
          </div>
        </>
      }
    />
  );
};

export default WorshipPadsRemote;
