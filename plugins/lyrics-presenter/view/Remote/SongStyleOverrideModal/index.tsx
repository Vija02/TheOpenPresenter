import type { LayoutDoc } from "@repo/layout";
import { Button, useOverlayToggle } from "@repo/ui";
import { hash } from "ohash";
import { useMemo } from "react";

import {
  Background,
  backgroundKey,
  isNoBackground,
} from "../../../src/backgrounds";
import {
  sceneBackground,
  sceneTemplate,
  songTemplate,
} from "../../../src/template/layout";
import { Song } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { useActivateLyricSlide } from "../../useActivateLyricSlide";
import { useSongbookSync } from "../../useSongbookSync";
import { LayoutEditorDialog, LayoutValue } from "../LayoutEditorDialog";

export type SongStyleOverrideModalProps = {
  song: Song;
};

const sameTemplate = (a: LayoutDoc, b: LayoutDoc) => hash(a) === hash(b);

const sameBackground = (a: Background | null, b: Background | null) => {
  const key = (x: Background | null) =>
    x === null || isNoBackground(x) ? null : backgroundKey(x);
  return key(a) === key(b);
};

const SongStyleOverrideModal = ({ song }: SongStyleOverrideModalProps) => {
  const { isOpen, onToggle } = useOverlayToggle();

  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const { saveToSongbook } = useSongbookSync();
  const { reactivateLive } = useActivateLyricSlide();

  const template = pluginApi.scene.useData((x) => x.pluginData.template);
  const background = pluginApi.scene.useData((x) => x.pluginData.background);

  const scene = useMemo(
    () => ({
      template: sceneTemplate({ template }),
      background: sceneBackground({ background }),
    }),
    [template, background],
  );

  const value = useMemo(
    () => ({
      template: songTemplate(song, { template }),
      // Null follows the scene, which the dialog shows as its fallback
      background: song.background,
    }),
    [song, template],
  );

  const write = (next: Pick<Song, "template" | "background">) => {
    const sceneSong = mutableSceneData.pluginData.songs.find(
      (x) => x.id === song.id,
    );
    if (!sceneSong) return;

    sceneSong.template = next.template;
    sceneSong.background = next.background;
    // The live slide's background may have changed under it
    reactivateLive();

    if (song.songbookId) void saveToSongbook({ ...song, ...next });
  };

  const onSave = (next: LayoutValue) =>
    write({
      template:
        song.template === null && sameTemplate(next.template, scene.template)
          ? null
          : next.template,
      background:
        song.background === null &&
        sameBackground(next.background, scene.background)
          ? null
          : next.background,
    });

  const isOwn = song.template !== null || song.background !== null;

  return (
    <LayoutEditorDialog
      isOpen={isOpen ?? false}
      onToggle={() => onToggle?.()}
      title={`Song Layout - "${song.title}"`}
      value={value}
      sampleSong={song}
      fallback={{ background: scene.background }}
      aiThreadKey={`lyrics:${pluginApi.pluginContext.pluginId}:${song.id}`}
      onSave={onSave}
      footerStart={() =>
        isOwn && (
          <Button
            variant="outline"
            onClick={() => {
              const ok = window.confirm(
                "Reset this song to the scene's layout and background? Its own layout is discarded.",
              );
              if (!ok) return;
              write({ template: null, background: null });
              onToggle?.();
            }}
          >
            Reset to default
          </Button>
        )
      }
    />
  );
};

export default SongStyleOverrideModal;
