import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Input, cn, useDisclosure } from "@repo/ui";
import getYouTubeID from "get-youtube-id";
import { useState } from "react";
import { FaPause, FaPlay } from "react-icons/fa6";
import { IoMdClose } from "react-icons/io";
import { VscGripper } from "react-icons/vsc";
import { typeidUnboxed } from "typeid-js";

import { Track } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { isTrackReady, trackTitle } from "../trackHelpers";
import { trpc } from "../trpc";
import { usePlaylistPosition } from "../usePlaylistPosition";
import { TrackThumbnail } from "./TrackThumbnail";
import YoutubeSearchModal, { YoutubeSearchResult } from "./YoutubeSearchModal";
import { formatDuration } from "./formatDuration";
import { PlayerControls } from "./usePlayerControls";
import { getYoutubePlaylistId } from "./youtubePlaylistId";

function isValidHttpUrl(string: string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const createYoutubeTrack = (result: YoutubeSearchResult): Track => ({
  id: typeidUnboxed("track"),
  type: "youtube",
  url: `https://www.youtube.com/watch?v=${result.videoId}`,
  metadata: JSON.parse(
    JSON.stringify({
      title: result.title,
      author: result.author,
      duration: result.duration,
      thumbnailUrl: result.thumbnailUrl,
    }),
  ),
});

export const PlaylistTab = ({ controls }: { controls: PlayerControls }) => {
  const pluginApi = usePluginAPI();
  const youtubeMetadata = trpc.musicPlayer.youtubeMetadata.useMutation();
  const youtubePlaylist = trpc.musicPlayer.youtubePlaylist.useMutation();

  const tracks = pluginApi.scene.useData((x) => x.pluginData.tracks) ?? [];
  const { itemId: activeTrackId, isPlaying: trackIsPlaying } =
    usePlaylistPosition();

  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  // A video opened from a playlist, waiting on which of the two to add
  const [videoInPlaylist, setVideoInPlaylist] = useState<{
    url: string;
    videoId: string;
    playlistId: string;
  } | null>(null);
  const searchDisclosure = useDisclosure();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = tracks.map((x) => x.id);
    controls.moveTrack(
      ids.indexOf(active.id as string),
      ids.indexOf(over.id as string),
    );
  };

  const finishAdding = () => {
    setError(null);
    setInput("");
    setVideoInPlaylist(null);
  };

  const addVideo = async (url: string, videoId: string) => {
    setIsAdding(true);
    try {
      const metadata = await youtubeMetadata.mutateAsync({ url });
      controls.addTracks([
        createYoutubeTrack({ ...metadata, title: metadata.title ?? url }),
      ]);
    } catch (err) {
      // Still playable, the renderer fills in the duration once it loads
      pluginApi.log.warn({ err, url }, "Failed to fetch track metadata");
      controls.addTracks([createYoutubeTrack({ videoId, title: url })]);
    } finally {
      setIsAdding(false);
    }
    setNotice(null);
    finishAdding();
  };

  const addPlaylist = async (playlistId: string) => {
    setIsAdding(true);
    try {
      const playlist = await youtubePlaylist.mutateAsync({ playlistId });
      if (playlist.videos.length === 0) {
        setError("That playlist has no videos we can play.");
        return;
      }

      controls.addTracks(playlist.videos.map(createYoutubeTrack));
      const name = playlist.title ? ` from "${playlist.title}"` : "";
      setNotice(
        playlist.isTruncated
          ? `Added the first ${playlist.videos.length} tracks${name}.`
          : `Added ${playlist.videos.length} tracks${name}.`,
      );
      finishAdding();
    } catch (err) {
      pluginApi.log.warn({ err, playlistId }, "Failed to fetch playlist");
      setError("Couldn't load that playlist. It may be private.");
    } finally {
      setIsAdding(false);
    }
  };

  const onSubmit = async () => {
    const value = input.trim();
    if (!value) return;
    setNotice(null);
    setVideoInPlaylist(null);

    if (!isValidHttpUrl(value)) {
      setError(null);
      setSearchQuery(value);
      searchDisclosure.onOpen();
      return;
    }

    const videoId = getYouTubeID(value);
    const playlistId = getYoutubePlaylistId(value);

    if (videoId && playlistId) {
      setError(null);
      setVideoInPlaylist({ url: value, videoId, playlistId });
    } else if (playlistId) {
      await addPlaylist(playlistId);
    } else if (videoId) {
      await addVideo(value, videoId);
    } else {
      setError("Only YouTube links are supported for now.");
    }
  };

  return (
    <div className="stack-col items-stretch">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="stack-row">
          <Input
            className="flex-1 min-w-0"
            placeholder="Search YouTube or paste a link..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" variant="success" disabled={isAdding}>
            {isAdding ? "Adding..." : "Go"}
          </Button>
        </div>
        {error && <div className="text-fill-destructive mt-1">{error}</div>}
        {notice && <div className="text-secondary mt-1">{notice}</div>}
        {videoInPlaylist && (
          <div className="stack-row flex-wrap mt-2 p-2 rounded-sm bg-gray-100">
            <span className="flex-1">This video is part of a playlist.</span>
            <Button
              size="sm"
              variant="outline"
              disabled={isAdding}
              onClick={() =>
                addVideo(videoInPlaylist.url, videoInPlaylist.videoId)
              }
            >
              Add this video
            </Button>
            <Button
              size="sm"
              variant="success"
              disabled={isAdding}
              onClick={() => addPlaylist(videoInPlaylist.playlistId)}
            >
              Add whole playlist
            </Button>
          </div>
        )}
      </form>

      <YoutubeSearchModal
        isOpen={searchDisclosure.open}
        onToggle={searchDisclosure.onToggle}
        searchQuery={searchQuery}
        onAdd={(result) => {
          controls.addTracks([createYoutubeTrack(result)]);
          setInput("");
        }}
      />

      {tracks.length === 0 && (
        <div className="text-secondary py-4">
          No tracks yet. Search YouTube or paste a link to build a playlist.
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={tracks.map((x) => x.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="stack-col items-stretch gap-1">
            {tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                isActive={track.id === activeTrackId}
                isPlaying={track.id === activeTrackId && trackIsPlaying}
                controls={controls}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

const TrackRow = ({
  track,
  isActive,
  isPlaying,
  controls,
}: {
  track: Track;
  isActive: boolean;
  isPlaying: boolean;
  controls: PlayerControls;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const title = trackTitle(track);
  const isReady = isTrackReady(track);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid="playlist-track"
      className={cn(
        "stack-row gap-2 p-1 rounded-sm border @md:gap-2.5",
        // Opaque so a dragged row covers the ones it passes
        isActive
          ? "bg-gray-100 border-fill-default"
          : "bg-white border-transparent",
        isDragging && "relative z-10 shadow-md",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        className="shrink-0 px-1 py-2 text-secondary cursor-grab touch-none active:cursor-grabbing"
        aria-label={`Reorder ${title}`}
        {...attributes}
        {...listeners}
      >
        <VscGripper />
      </button>
      <Button
        variant={isPlaying ? "default" : "outline"}
        size="sm"
        // Same width either way, so the row doesn't shift
        className="w-10 shrink-0"
        disabled={!isReady}
        onClick={() => controls.toggleTrack(track.id)}
        aria-label={`${isPlaying ? "Pause" : "Play"} ${title}`}
      >
        {isPlaying ? <FaPause /> : <FaPlay />}
      </Button>
      {/* Narrow screens need the room for the title */}
      <TrackThumbnail track={track} className="hidden w-16 @sm:block" />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-xs text-secondary">
          {isReady
            ? [
                track.metadata.author,
                track.metadata.duration
                  ? formatDuration(track.metadata.duration)
                  : null,
              ]
                .filter(Boolean)
                .join(" • ")
            : "Processing..."}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => controls.removeTrack(track.id)}
        aria-label="Remove"
      >
        <IoMdClose />
      </Button>
    </div>
  );
};
