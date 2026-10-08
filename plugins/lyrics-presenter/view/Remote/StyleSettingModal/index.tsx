import { Button, useOverlayToggle } from "@repo/ui";
import { useCallback, useMemo } from "react";

import {
  MAIN_LOOK,
  builtInLook,
  listLooks,
  resolveLook,
  sameLayout,
} from "../../../src/looks";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { LayoutEditorDialog, LayoutValue } from "../LayoutEditorDialog";

const StyleSettingModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();

  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const looks = pluginApi.scene.useData((x) => x.pluginData.looks);

  const saveLook = trpc.lyricsPresenter.looks.save.useMutation();
  const resetLook = trpc.lyricsPresenter.looks.reset.useMutation();

  const options = useMemo(() => listLooks(looks), [looks]);

  const valueFor = useCallback(
    (key: string): LayoutValue => {
      const look = resolveLook(looks, key);
      return { template: look.template, background: look.background };
    },
    [looks],
  );

  // The server updates every open scene's copy, this one included
  const onSave = (edited: Record<string, LayoutValue>) => {
    const saves = Object.entries(edited).map(([key, value]) => {
      const builtIn = builtInLook(key);
      if (builtIn && sameLayout(value, builtIn)) {
        // Back on the default, so it follows future changes to it
        return resetLook.mutateAsync({ pluginId, key });
      }
      const { name, position } = resolveLook(looks, key);
      return saveLook.mutateAsync({
        pluginId,
        look: { key, name, position, ...value },
      });
    });
    void Promise.all(saves).catch(() =>
      pluginApi.remote.toast.error("Failed to save the global style"),
    );
  };

  return (
    <LayoutEditorDialog
      isOpen={isOpen ?? false}
      onToggle={() => onToggle?.()}
      title="Global style"
      looks={options}
      initialLook={MAIN_LOOK}
      valueFor={valueFor}
      aiThreadKey={(key) => `lyrics:${pluginId}:look:${key}`}
      onSave={onSave}
      footerStart={({ lookKey, value, setValue }) => {
        const builtIn = builtInLook(lookKey);
        return (
          builtIn &&
          !sameLayout(value, builtIn) && (
            <Button variant="outline" onClick={() => setValue(builtIn)}>
              Reset to default
            </Button>
          )
        );
      }}
    />
  );
};

export default StyleSettingModal;
