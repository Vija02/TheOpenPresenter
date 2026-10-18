import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  LoadingInline,
  PopConfirm,
  cn,
} from "@repo/ui";
import { useState } from "react";
import { FaPlay } from "react-icons/fa6";
import { MdQueueMusic } from "react-icons/md";
import {
  VscAdd,
  VscArrowLeft,
  VscCheck,
  VscEdit,
  VscTrash,
} from "react-icons/vsc";

import { SavedPlaylist } from "../../src/types";
import { trackTitle } from "../trackHelpers";
import { PlaylistCover } from "./PlaylistCover";
import { TrackThumbnail } from "./TrackThumbnail";
import { formatDuration } from "./formatDuration";
import { SavedPlaylists, tracksSummary } from "./useSavedPlaylists";

export const SavedPlaylistsModal = ({
  isOpen,
  onToggle,
  saved,
  hasTracks,
  onLoaded,
}: {
  isOpen: boolean;
  onToggle: () => void;
  saved: SavedPlaylists;
  hasTracks: boolean;
  onLoaded: () => void;
}) => {
  const [search, setSearch] = useState("");
  // Null shows the list on narrow screens, and the first playlist on wide ones
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? saved.playlists.filter((x) => x.name.toLowerCase().includes(query))
    : saved.playlists;
  const selected =
    saved.playlists.find((x) => x.id === selectedId) ?? filtered[0] ?? null;

  const onOpenChange = () => {
    setSearch("");
    setSelectedId(null);
    onToggle();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        size="3xl"
        className="md:max-w-5xl md:h-[min(760px,85vh)] gap-0"
      >
        <DialogHeader className="pb-4 border-b border-stroke">
          <DialogTitle className="stack-row gap-2 text-xl">
            <MdQueueMusic className="size-6" />
            Saved playlists
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="px-0 gap-0 min-h-0 overflow-hidden md:flex-row">
          {saved.isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <LoadingInline />
            </div>
          ) : saved.playlists.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div
                className={cn(
                  "flex-col min-h-0 md:w-80 md:shrink-0 md:border-r md:border-stroke",
                  selectedId ? "hidden md:flex" : "flex flex-1 md:flex-none",
                )}
              >
                <div className="p-3">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search playlists..."
                  />
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-3">
                  {filtered.length === 0 ? (
                    <p className="text-secondary text-sm py-8 text-center">
                      No playlists match &quot;{search}&quot;.
                    </p>
                  ) : (
                    filtered.map((playlist) => (
                      <button
                        key={playlist.id}
                        data-testid="saved-playlist-row"
                        onClick={() => setSelectedId(playlist.id)}
                        className={cn(
                          "stack-row gap-3 w-full p-2 rounded-md text-left transition-colors cursor-pointer",
                          playlist.id === selected?.id
                            ? "md:bg-surface-secondary"
                            : "hover:bg-surface-secondary",
                        )}
                      >
                        <PlaylistCover
                          tracks={playlist.tracks}
                          className="w-12"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">
                            {playlist.name}
                          </p>
                          <p className="truncate text-xs text-secondary">
                            {tracksSummary(playlist.tracks)}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "flex-1 min-w-0 min-h-0 flex-col",
                  selectedId ? "flex" : "hidden md:flex",
                )}
              >
                {selected && (
                  <PlaylistDetail
                    // Fresh rename and "Added" state for each playlist
                    key={selected.id}
                    playlist={selected}
                    saved={saved}
                    hasTracks={hasTracks}
                    onBack={() => setSelectedId(null)}
                    onLoaded={() => {
                      onOpenChange();
                      onLoaded();
                    }}
                  />
                )}
              </div>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

const EmptyState = () => (
  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
    <div className="flex size-16 items-center justify-center rounded-full bg-surface-secondary text-secondary">
      <MdQueueMusic className="size-8" />
    </div>
    <p className="text-lg font-semibold">No saved playlists yet</p>
    <p className="max-w-sm text-sm text-secondary">
      Create a playlist and save it. It will show up here, ready to be loaded
      everywhere.
    </p>
  </div>
);

const PlaylistDetail = ({
  playlist,
  saved,
  hasTracks,
  onBack,
  onLoaded,
}: {
  playlist: SavedPlaylist;
  saved: SavedPlaylists;
  hasTracks: boolean;
  onBack: () => void;
  onLoaded: () => void;
}) => {
  const [newName, setNewName] = useState<string | null>(null);
  const [appended, setAppended] = useState(false);

  const load = () => {
    saved.load(playlist);
    onLoaded();
  };

  const finishRename = () => {
    const name = newName?.trim();
    if (name && name !== playlist.name) saved.rename(playlist.id, name);
    setNewName(null);
  };

  const loadButton = (onClick?: () => void) => (
    <Button
      size="lg"
      variant="success"
      className="flex-1 sm:flex-none"
      onClick={onClick}
    >
      <FaPlay />
      Load playlist
    </Button>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="relative p-4 md:p-6">
        <PopConfirm
          title={`Delete "${playlist.name}"?`}
          description="Scenes already using it keep their tracks."
          okText="Delete"
          onConfirm={() => {
            saved.remove(playlist.id);
            onBack();
          }}
        >
          <Button
            size="icon"
            variant="ghost"
            title="Delete"
            className="absolute top-3 right-3 md:top-4 md:right-4"
          >
            <VscTrash />
          </Button>
        </PopConfirm>

        <Button
          size="sm"
          variant="ghost"
          className="mb-3 md:hidden"
          onClick={onBack}
        >
          <VscArrowLeft />
          All playlists
        </Button>

        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:text-left">
          <PlaylistCover
            tracks={playlist.tracks}
            className="w-32 shadow-md md:w-40"
          />
          <div className="w-full min-w-0 sm:flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-secondary">
              Playlist
            </p>
            {newName !== null ? (
              <form
                className="my-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  finishRename();
                }}
              >
                <Input
                  autoFocus
                  aria-label="Playlist name"
                  className="text-xl font-bold"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setNewName(null);
                    }
                  }}
                />
              </form>
            ) : (
              <h2 className="my-1 text-2xl font-bold lg:text-3xl">
                <button
                  className="group inline-flex max-w-full items-center gap-2 text-center cursor-pointer sm:text-left"
                  title="Rename"
                  onClick={() => setNewName(playlist.name)}
                >
                  {/* Long names wrap rather than lose their end */}
                  <span className="line-clamp-2 break-words">
                    {playlist.name}
                  </span>
                  <VscEdit className="size-5 shrink-0 text-secondary opacity-60 group-hover:opacity-100" />
                </button>
              </h2>
            )}
            <p className="text-sm text-secondary">
              {tracksSummary(playlist.tracks)}
            </p>
          </div>
        </div>

        <div className="stack-row gap-2 mt-5">
          {hasTracks ? (
            <PopConfirm
              title="Replace the current playlist?"
              description="Any music playing from it will stop."
              okText="Replace"
              onConfirm={load}
            >
              {loadButton()}
            </PopConfirm>
          ) : (
            loadButton(load)
          )}
          {hasTracks && (
            <Button
              size="lg"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => {
                saved.append(playlist);
                setAppended(true);
              }}
            >
              {appended ? <VscCheck /> : <VscAdd />}
              {appended ? "Added" : "Add to end"}
            </Button>
          )}
        </div>
      </div>

      <ol className="px-2 pb-4 md:px-4">
        {playlist.tracks.map((track, i) => (
          <li key={track.id} className="stack-row gap-3 px-2 py-1.5">
            <span className="w-6 shrink-0 text-right text-sm tabular-nums text-secondary">
              {i + 1}
            </span>
            <TrackThumbnail track={track} className="w-16" />
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{trackTitle(track)}</p>
              {track.metadata.author && (
                <p className="truncate text-xs text-secondary">
                  {track.metadata.author}
                </p>
              )}
            </div>
            {!!track.metadata.duration && (
              <span className="shrink-0 text-sm tabular-nums text-secondary">
                {formatDuration(track.metadata.duration)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};
