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
import { trpc } from "../trpc";
import { usePlaylistPosition } from "../usePlaylistPosition";
import { TrackThumbnail } from "./TrackThumbnail";
import YoutubeSearchModal, { YoutubeSearchResult } from "./YoutubeSearchModal";
import { formatDuration } from "./formatDuration";
import { PlayerControls } from "./usePlayerControls";

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

  const tracks = pluginApi.scene.useData((x) => x.pluginData.tracks) ?? [];
  const { itemId: activeTrackId, isPlaying: trackIsPlaying } =
    usePlaylistPosition();

  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
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

  const onSubmit = async () => {
    const value = input.trim();
    if (!value) return;

    if (!isValidHttpUrl(value)) {
      setError(null);
      setSearchQuery(value);
      searchDisclosure.onOpen();
      return;
    }

    const videoId = getYouTubeID(value);
    if (!videoId) {
      setError("Only YouTube links are supported for now.");
      return;
    }

    setIsAdding(true);
    try {
      const metadata = await youtubeMetadata.mutateAsync({ url: value });
      controls.addTracks([
        createYoutubeTrack({ ...metadata, title: metadata.title ?? value }),
      ]);
    } catch (err) {
      // Still playable, the renderer fills in the duration once it loads
      pluginApi.log.warn({ err, url: value }, "Failed to fetch track metadata");
      controls.addTracks([createYoutubeTrack({ videoId, title: value })]);
    } finally {
      setIsAdding(false);
    }
    setError(null);
    setInput("");
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
            className="flex-1"
            placeholder="Search YouTube or paste a link..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" variant="success" disabled={isAdding}>
            {isAdding ? "Adding..." : "Go"}
          </Button>
        </div>
        {error && <div className="text-fill-destructive mt-1">{error}</div>}
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

  const title = track.metadata.title ?? track.url;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid="playlist-track"
      className={cn(
        "stack-row p-1 rounded-sm border",
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
        onClick={() => controls.toggleTrack(track.id)}
        aria-label={`${isPlaying ? "Pause" : "Play"} ${title}`}
      >
        {isPlaying ? <FaPause /> : <FaPlay />}
      </Button>
      <TrackThumbnail track={track} className="w-16" />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-xs text-secondary">
          {[
            track.metadata.author,
            track.metadata.duration
              ? formatDuration(track.metadata.duration)
              : null,
          ]
            .filter(Boolean)
            .join(" • ")}
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
