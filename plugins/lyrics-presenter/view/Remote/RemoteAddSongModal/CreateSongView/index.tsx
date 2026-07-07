import { Button } from "@repo/ui";
import { isEqual } from "lodash-es";
import { useState } from "react";
import { typeidUnboxed } from "typeid-js";

import { Song } from "../../../../src";
import { getMergedSlideStyle } from "../../../../src/slideStyle";
import { usePluginAPI } from "../../../pluginApi";
import { SongViewSlides } from "../../SongViewSlides";
import { AddSongFooter } from "../AddSongFooter";
import { CreateNewSong } from "./CreateNewSong";
import { useAddSongScene } from "../useAddSongScene";

export const CreateSongView = () => {
  const pluginApi = usePluginAPI();
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style) ?? {};
  const { close, addSong } = useAddSongScene();

  const [newSong, setNewSong] = useState<Song | null>(null);
  const [saveToSongbook, setSaveToSongbook] = useState(true);

  const submit = () => {
    if (!newSong) return;
    const created = { ...newSong, id: typeidUnboxed() };
    addSong(created, saveToSongbook);
    close();
  };

  const preview = newSong ? (
    <SongViewSlides
      song={newSong}
      slideStyle={getMergedSlideStyle(globalStyle, newSong.styleOverride)}
      isPreview
    />
  ) : null;

  return (
    <>
      <CreateNewSong
        onChange={(song) => {
          if (!isEqual(song, newSong)) {
            setNewSong(song);
          }
        }}
      />

      <AddSongFooter preview={preview}>
        <label className="stack-row items-center gap-2 mr-auto cursor-pointer select-none">
          <input
            type="checkbox"
            checked={saveToSongbook}
            onChange={(e) => setSaveToSongbook(e.target.checked)}
          />
          <span className="text-sm">Save to songbook</span>
        </label>
        <Button variant="success" disabled={!newSong} onClick={submit}>
          Add to list
        </Button>
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
      </AddSongFooter>
    </>
  );
};
