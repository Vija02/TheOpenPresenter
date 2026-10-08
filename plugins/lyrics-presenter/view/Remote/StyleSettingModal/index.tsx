import { Button, useOverlayToggle } from "@repo/ui";
import { useMemo } from "react";

import {
  DEFAULT_SCENE_BACKGROUND,
  sceneBackground,
  sceneTemplate,
} from "../../../src/template/layout";
import { defaultLyricsTemplate } from "../../../src/template/presets";
import { usePluginAPI } from "../../pluginApi";
import { useActivateLyricSlide } from "../../useActivateLyricSlide";
import { LayoutEditorDialog } from "../LayoutEditorDialog";

/** The scene's layout and default background */
const StyleSettingModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();

  const pluginApi = usePluginAPI();
  const mutablePluginInfo = pluginApi.scene.useValtioData();
  const { reactivateLive } = useActivateLyricSlide();

  const template = pluginApi.scene.useData((x) => x.pluginData.template);
  const background = pluginApi.scene.useData((x) => x.pluginData.background);
  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);

  const value = useMemo(
    () => ({
      template: sceneTemplate({ template }),
      background: sceneBackground({ background }),
    }),
    [template, background],
  );

  return (
    <LayoutEditorDialog
      isOpen={isOpen ?? false}
      onToggle={() => onToggle?.()}
      title="Slide Layout"
      value={value}
      sampleSong={songs.find((x) => x.setting.displayType === "sections")}
      aiThreadKey={`lyrics:${pluginApi.pluginContext.pluginId}`}
      onSave={(next) => {
        mutablePluginInfo.pluginData.template = next.template;
        mutablePluginInfo.pluginData.background = next.background;
        // The default background may be what the live slide shows
        reactivateLive();
      }}
      footerStart={({ setValue }) => (
        <Button
          variant="outline"
          onClick={() =>
            setValue({
              template: defaultLyricsTemplate(),
              background: DEFAULT_SCENE_BACKGROUND,
            })
          }
        >
          Reset to default
        </Button>
      )}
    />
  );
};

export default StyleSettingModal;
