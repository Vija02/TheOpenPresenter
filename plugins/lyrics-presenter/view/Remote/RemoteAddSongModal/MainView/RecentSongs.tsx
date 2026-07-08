import { DateDisplayRelative } from "@repo/ui";
import { Dispatch, SetStateAction } from "react";
import { VscChevronDown, VscChevronRight } from "react-icons/vsc";

import { SavedSong } from "../../../../src";
import { usePluginAPI } from "../../../pluginApi";
import { trpc } from "../../../trpc";
import { SavedSongPreview } from "./SavedSongPreview";

export const RecentSongs = ({
  selectedSavedSong,
  setSelectedSavedSong,
  open,
  onToggleOpen,
}: {
  selectedSavedSong: SavedSong | null;
  setSelectedSavedSong: Dispatch<SetStateAction<SavedSong | null>>;
  open: boolean;
  onToggleOpen: () => void;
}) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const recentQuery = trpc.lyricsPresenter.savedSongs.recent.useQuery({
    pluginId,
  });
  const recentSongs = recentQuery.data ?? [];

  if (recentSongs.length === 0) return null;

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex items-center gap-2 w-full text-left cursor-pointer"
      >
        {open ? <VscChevronDown /> : <VscChevronRight />}
        <p className="font-bold">Recently used songs</p>
      </button>

      {open && (
        <div className="mt-2">
          {recentSongs.map((saved) => {
            const isSelected = selectedSavedSong?.id === saved.id;
            return (
              <div key={saved.id}>
                <div
                  data-testid="ly-recent-song"
                  onClick={() => setSelectedSavedSong(saved)}
                  className={`cursor-pointer py-1 px-1 ${
                    isSelected
                      ? "bg-surface-primary-active"
                      : "hover:bg-surface-primary-hover"
                  }`}
                >
                  <p className="text-xs text-secondary leading-4">
                    <DateDisplayRelative date={new Date(saved.usedAt)} />
                  </p>
                  <p className="leading-4">{saved.title || "Untitled"}</p>
                  <p className="text-xs text-secondary">
                    {saved.author ? saved.author : "-"}
                  </p>
                </div>
                {isSelected && (
                  <SavedSongPreview
                    saved={saved}
                    onClose={() => setSelectedSavedSong(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
