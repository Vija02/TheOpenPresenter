import { Button } from "@repo/ui";
import { useEffect, useState } from "react";

import { SavedSong } from "../../../../src";
import { getMergedSlideStyle } from "../../../../src/slideStyle";
import { usePluginAPI } from "../../../pluginApi";
import { SongViewSlides } from "../../SongViewSlides";
import { AddSongFooter } from "../AddSongFooter";
import { useAddSongScene } from "../useAddSongScene";
import { ImportPlaylist, Setlist } from "./ImportPlaylist";
import { SearchSong } from "./SearchSong";

type MainViewProps = {
  onImportSong: (mwlId: number) => void;
  onSelectSetlist: (setlist: Setlist) => void;
};

export const MainView = ({ onImportSong, onSelectSetlist }: MainViewProps) => {
  const pluginApi = usePluginAPI();
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style) ?? {};
  const { close, addLinkedSavedSong } = useAddSongScene();

  const [selectedSavedSong, setSelectedSavedSong] = useState<SavedSong | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);
  const [setlistOpen, setSetlistOpen] = useState(true);
  useEffect(() => {
    setSetlistOpen(!isSearching);
  }, [isSearching]);

  const submit = () => {
    if (!selectedSavedSong) return;
    addLinkedSavedSong(selectedSavedSong);
    close();
  };

  const preview = selectedSavedSong ? (
    <SongViewSlides
      song={selectedSavedSong.song}
      slideStyle={getMergedSlideStyle(
        globalStyle,
        selectedSavedSong.song.styleOverride,
      )}
      isPreview
    />
  ) : null;

  return (
    <div className="stack-col items-stretch gap-4 min-w-0">
      <SearchSong
        initialValue={null}
        selectedSavedSong={selectedSavedSong}
        setSelectedSavedSong={setSelectedSavedSong}
        onSelectImportSong={onImportSong}
        onSearchingChange={setIsSearching}
      />

      <ImportPlaylist
        open={setlistOpen}
        onToggleOpen={() => setSetlistOpen((o) => !o)}
        onSelectSetlist={onSelectSetlist}
      />

      <AddSongFooter preview={preview}>
        <Button
          variant="success"
          disabled={!selectedSavedSong}
          onClick={submit}
        >
          Add to list
        </Button>
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
      </AddSongFooter>
    </div>
  );
};
