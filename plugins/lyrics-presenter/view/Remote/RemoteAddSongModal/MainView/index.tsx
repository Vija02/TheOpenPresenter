import { useEffect, useState } from "react";

import { SavedSong } from "../../../../src";
import { ImportPlaylist, Setlist } from "./ImportPlaylist";
import { RecentSongs } from "./RecentSongs";
import { SearchSong } from "./SearchSong";

type MainViewProps = {
  onImportSong: (mwlId: number) => void;
  onSelectSetlist: (setlist: Setlist) => void;
};

export const MainView = ({ onImportSong, onSelectSetlist }: MainViewProps) => {
  const [selectedSavedSong, setSelectedSavedSong] = useState<SavedSong | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);
  const [setlistOpen, setSetlistOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  useEffect(() => {
    setSetlistOpen(!isSearching);
    setRecentOpen(!isSearching);
  }, [isSearching]);

  return (
    <div className="stack-col items-stretch gap-4 min-w-0 flex-1 min-h-0">
      <SearchSong
        initialValue={null}
        selectedSavedSong={selectedSavedSong}
        setSelectedSavedSong={setSelectedSavedSong}
        onSelectImportSong={onImportSong}
        onSearchingChange={setIsSearching}
      />

      <RecentSongs
        selectedSavedSong={selectedSavedSong}
        setSelectedSavedSong={setSelectedSavedSong}
        open={recentOpen}
        onToggleOpen={() => setRecentOpen((o) => !o)}
      />

      <ImportPlaylist
        open={setlistOpen}
        onToggleOpen={() => setSetlistOpen((o) => !o)}
        onSelectSetlist={onSelectSetlist}
      />
    </div>
  );
};
