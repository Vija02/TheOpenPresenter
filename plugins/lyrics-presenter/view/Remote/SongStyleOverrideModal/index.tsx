import { Button, useOverlayToggle } from "@repo/ui";
import { useCallback, useMemo } from "react";

import {
  SongLook,
  listLooks,
  lookKeyFor,
  resolveLook,
  sameBackground,
  sameTemplate,
  songLook,
  songLookTemplate,
} from "../../../src/looks";
import { Song } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { useActivateLyricSlide } from "../../useActivateLyricSlide";
import { useSongbookSync } from "../../useSongbookSync";
import { LayoutEditorDialog, LayoutValue } from "../LayoutEditorDialog";

export type SongStyleOverrideModalProps = {
  song: Song;
};

/**
 * The song's own versions of the organization's looks, each starting as a
 * copy. Whatever matches the look is saved as following it
 */
const SongStyleOverrideModal = ({ song }: SongStyleOverrideModalProps) => {
  const { isOpen, onToggle } = useOverlayToggle();

  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const { saveToSongbook } = useSongbookSync();
  const { reactivateLive } = useActivateLyricSlide();

  const looks = pluginApi.scene.useData((x) => x.pluginData.looks);
  const options = useMemo(() => listLooks(looks), [looks]);

  const valueFor = useCallback(
    (key: string): LayoutValue => ({
      template: songLookTemplate(song, key, looks),
      // Null follows the look, which the dialog shows as its fallback
      background: songLook(song, key)?.background ?? null,
    }),
    [song, looks],
  );

  const fallbackFor = useCallback(
    (key: string) => ({ background: resolveLook(looks, key).background }),
    [looks],
  );

  const onSave = (edited: Record<string, LayoutValue>) => {
    const sceneSong = mutableSceneData.pluginData.songs.find(
      (x) => x.id === song.id,
    );
    if (!sceneSong) return;

    // Plain, from the snapshot
    const next: Record<string, SongLook> = JSON.parse(
      JSON.stringify(song.looks ?? {}),
    );
    for (const [key, value] of Object.entries(edited)) {
      const look = resolveLook(looks, key);
      const own: SongLook = {
        template: sameTemplate(value.template, look.template)
          ? null
          : value.template,
        background:
          value.background === null ||
          sameBackground(value.background, look.background)
            ? null
            : value.background,
      };
      if (own.template === null && own.background === null) delete next[key];
      else next[key] = own;
    }

    sceneSong.looks = next;
    // The live slide's background may have changed under it
    reactivateLive();

    if (song.songbookId) void saveToSongbook({ ...song, looks: next });
  };

  return (
    <LayoutEditorDialog
      isOpen={isOpen ?? false}
      onToggle={() => onToggle?.()}
      title={`Song style - "${song.title}"`}
      looks={options}
      initialLook={lookKeyFor(song)}
      valueFor={valueFor}
      fallbackFor={fallbackFor}
      sampleSong={song}
      aiThreadKey={(key) =>
        `lyrics:${pluginApi.pluginContext.pluginId}:${song.id}:${key}`
      }
      onSave={onSave}
      footerStart={({ lookKey, value, setValue }) => {
        const look = resolveLook(looks, lookKey);
        const isOwn =
          value.background !== null ||
          !sameTemplate(value.template, look.template);
        return (
          isOwn && (
            <Button
              variant="outline"
              onClick={() =>
                setValue({ template: look.template, background: null })
              }
            >
              Reset to default
            </Button>
          )
        );
      }}
    />
  );
};

export default SongStyleOverrideModal;
