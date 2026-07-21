import { Button, OverlayToggle, PluginScaffold } from "@repo/ui";
import { useCallback } from "react";
import { VscGear, VscPaintcan } from "react-icons/vsc";

import { usePluginAPI } from "../pluginApi";
import Landing from "./Landing";
import PassageView from "./PassageView";
import StyleModal from "./StyleModal";
import SearchBar from "./search/SearchBar";
import SettingsModal from "./translations/SettingsModal";

const Remote = () => {
  const pluginApi = usePluginAPI();
  const passages = pluginApi.scene.useData((x) => x.pluginData.passages);
  const mutableSceneData = pluginApi.scene.useValtioData();

  const swapPassages = useCallback(
    (a: number, b: number) => {
      const p = mutableSceneData.pluginData.passages;
      const temp = p[a]!;
      p[a] = p[b]!;
      p[b] = temp;
    },
    [mutableSceneData.pluginData.passages],
  );

  return (
    <PluginScaffold
      title="Bible"
      toolbar={
        <div className="flex items-center gap-2">
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                size="xs"
                variant="pill"
                onClick={onToggle}
                title="Translations"
                data-testid="bible-settings"
              >
                <VscGear />
                Translations
              </Button>
            )}
          >
            <SettingsModal />
          </OverlayToggle>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button size="xs" variant="pill" onClick={onToggle}>
                <VscPaintcan />
                Style
              </Button>
            )}
          >
            <StyleModal />
          </OverlayToggle>
        </div>
      }
      body={
        <div className="flex flex-col h-full w-full">
          <div className="p-3 border-b border-stroke bg-surface-primary">
            <SearchBar />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {passages.length === 0 ? (
              <Landing />
            ) : (
              passages.map((passage, index) => (
                <PassageView
                  key={passage.id}
                  passage={passage}
                  onMoveUp={
                    index > 0 ? () => swapPassages(index, index - 1) : undefined
                  }
                  onMoveDown={
                    index < passages.length - 1
                      ? () => swapPassages(index, index + 1)
                      : undefined
                  }
                />
              ))
            )}
          </div>
        </div>
      }
    />
  );
};

export default Remote;
