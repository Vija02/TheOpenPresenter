import { Button } from "@repo/ui";
import { ReactNode } from "react";
import { FaSpotify, FaYoutube } from "react-icons/fa";
import { MdQueueMusic, MdRadio } from "react-icons/md";
import { VscLibrary } from "react-icons/vsc";

import { PlaylistCover } from "./PlaylistCover";
import { SavedPlaylists, tracksSummary } from "./useSavedPlaylists";

const SHELF_COUNT = 6;

/** What an empty playlist shows instead: the ways to get music in */
export const EmptyPlaylist = ({
  saved,
  onSearch,
  onAddFromLibrary,
  onOpenRadio,
  onShowAllSaved,
}: {
  /** Null when saved playlists aren't available, e.g. on a public link */
  saved: SavedPlaylists | null;
  onSearch: () => void;
  onAddFromLibrary: () => void;
  onOpenRadio: () => void;
  onShowAllSaved: () => void;
}) => {
  const playlists = saved?.playlists ?? [];

  return (
    <div className="stack-col items-stretch gap-6 pt-4">
      <div className="stack-col items-center gap-2 text-center">
        <div className="flex size-20 items-center justify-center rounded-sm bg-primary">
          <MdQueueMusic className="text-surface-primary text-4xl" />
        </div>
        <p className="mt-1 text-lg font-semibold">Start the music</p>
        <p className="max-w-sm text-sm text-secondary">
          Play music in the background
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 @md:grid-cols-3">
        <StartCard
          icon={<YoutubeSpotifyIcon />}
          title="Search YouTube"
          description="Or paste a YouTube or Spotify link"
          onClick={onSearch}
        />
        <StartCard
          icon={<VscLibrary />}
          title="Media library"
          description="Music you've uploaded"
          onClick={onAddFromLibrary}
        />
        <StartCard
          icon={<MdRadio />}
          title="Radio station"
          description="Stream a live station instead"
          onClick={onOpenRadio}
        />
      </div>

      {saved && playlists.length > 0 && (
        <div className="stack-col items-stretch gap-2">
          <div className="stack-row justify-between">
            <p className="font-semibold">Your saved playlists</p>
            {playlists.length > SHELF_COUNT && (
              <Button size="xs" variant="ghost" onClick={onShowAllSaved}>
                See all {playlists.length}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2 @3xl:grid-cols-3">
            {playlists.slice(0, SHELF_COUNT).map((playlist) => (
              <button
                key={playlist.id}
                data-testid="saved-playlist-quick-start"
                className="stack-row gap-3 p-2 rounded-sm border border-stroke text-left transition-colors cursor-pointer hover:border-stroke-emphasis hover:bg-surface-secondary"
                onClick={() => saved.load(playlist)}
              >
                <PlaylistCover tracks={playlist.tracks} className="w-14" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{playlist.name}</p>
                  <p className="truncate text-xs text-secondary">
                    {tracksSummary(playlist.tracks)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const YoutubeSpotifyIcon = () => (
  <span className="relative block size-7" aria-hidden>
    <span className="absolute inset-0 [clip-path:polygon(0_0,100%_0,0_100%)]">
      <FaYoutube className="absolute top-0 left-0 size-[70%] text-[#FF0000]" />
    </span>
    <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
      <FaSpotify className="absolute right-0 bottom-0 size-[70%] text-[#1DB954]" />
    </span>
    <span className="absolute top-1/2 left-1/2 h-[110%] w-px -translate-1/2 rotate-45 bg-stroke-emphasis" />
  </span>
);

const StartCard = ({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    className="stack-row gap-3 p-3 rounded-sm border border-stroke text-left transition-colors cursor-pointer hover:border-stroke-emphasis hover:bg-surface-secondary"
    onClick={onClick}
  >
    <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-surface-secondary text-lg">
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block font-medium">{title}</span>
      <span className="block text-xs text-secondary">{description}</span>
    </span>
  </button>
);
