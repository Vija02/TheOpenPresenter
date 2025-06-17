import { Button, OverlayToggle, PopConfirm, SlideGrid } from "@repo/ui";
import React, { useCallback } from "react";
import { VscEdit, VscTrash } from "react-icons/vsc";

import { Song } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import RemoteEditSongModal from "./RemoteEditSongModal";
import { SongViewSlides } from "./SongViewSlides";

const SongView = React.memo(({ song }: { song: Song }) => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();

  const handleRemove = useCallback(() => {
    const pluginData = mutableSceneData.pluginData;

    pluginData.songs = pluginData.songs.filter((s) => s.id !== song.id);
  }, [mutableSceneData.pluginData, song.id]);

  if (!song._imported && !!song.import) {
    return (
      <div className="flex flex-col p-2 mb-2 bg-surface-secondary">
        <p className="font-bold">{song.title}</p>
        <div className="stack-row">
          <p>Importing data from {song.import.type}...</p>
          <Button size="sm" variant="ghost" onClick={handleRemove}>
            <VscTrash />
          </Button>
        </div>
      </div>
    );
  }
  return <SongViewInner song={song} />;
});

const SongViewInner = React.memo(({ song }: { song: Song }) => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style) ?? {};

  const handleRemove = useCallback(() => {
    const pluginData = mutableSceneData.pluginData;

    pluginData.songs = pluginData.songs.filter((s) => s.id !== song.id);
  }, [mutableSceneData.pluginData, song.id]);

  return (
    <div className="pb-4">
      <div className="flex flex-col items-start gap-2 mb-2 sm:flex-row sm:items-center">
        <p className="text-xl mb-0 font-bold">{song.title}</p>
        <div className="flex">
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button size="sm" variant="ghost" onClick={onToggle}>
                <VscEdit />
              </Button>
            )}
          >
            <RemoteEditSongModal song={song} />
          </OverlayToggle>
          <PopConfirm
            title={`Are you sure you want to remove this song?`}
            onConfirm={handleRemove}
            okText="Yes"
            cancelText="No"
            key="remove"
          >
            <Button size="sm" variant="ghost">
              <VscTrash />
            </Button>
          </PopConfirm>
        </div>
      </div>
      <SlideGrid>
        <SongViewSlides song={song} slideStyle={slideStyle} />
      </SlideGrid>
    </div>
  );
});

export default SongView;
