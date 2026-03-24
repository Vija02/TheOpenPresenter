import { Button, OverlayToggle, PopConfirm, SlideGrid } from "@repo/ui";
import React, { useCallback, useMemo } from "react";
import { MdStyle } from "react-icons/md";
import { VscEdit, VscTrash } from "react-icons/vsc";

import { getMergedSlideStyle } from "../../src/slideStyle";
import { Song } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import RemoteEditSongModal from "./RemoteEditSongModal";
import SongStyleOverrideModal from "./SongStyleOverrideModal";
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
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const handleRemove = useCallback(() => {
    const pluginData = mutableSceneData.pluginData;

    pluginData.songs = pluginData.songs.filter((s) => s.id !== song.id);
  }, [mutableSceneData.pluginData, song.id]);

  const slideStyle = useMemo(
    () => getMergedSlideStyle(globalStyle, song.styleOverride),
    [globalStyle, song.styleOverride],
  );

  return (
    <div className="pb-4">
      <div className="flex flex-col items-start gap-2 mb-2 sm:flex-row sm:items-center">
        <p className="text-xl mb-0 font-bold">{song.title}</p>
        <div className="flex">
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggle}
                data-testid="ly-edit-song"
              >
                <VscEdit />
              </Button>
            )}
          >
            <RemoteEditSongModal song={song} />
          </OverlayToggle>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggle}
                data-testid="ly-style-song"
                title="Style Override"
              >
                <MdStyle />
              </Button>
            )}
          >
            <SongStyleOverrideModal song={song} />
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
      <SlideGrid pluginAPI={pluginApi}>
        <SongViewSlides song={song} slideStyle={slideStyle} />
      </SlideGrid>
    </div>
  );
});

export default SongView;
