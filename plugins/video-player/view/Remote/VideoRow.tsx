import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, cn } from "@repo/ui";
import { UniversalVideo } from "@repo/video";
import { FaPause, FaPlay } from "react-icons/fa6";
import { IoMdClose } from "react-icons/io";
import { VscGripper } from "react-icons/vsc";

import { VideoThumbnail } from "./VideoThumbnail";
import { formatDuration } from "./formatDuration";
import { VideoPlayerControls } from "./useVideoPlayerControls";

export const VideoRow = ({
  video,
  isActive,
  isPlaying,
  controls,
}: {
  video: UniversalVideo;
  isActive: boolean;
  isPlaying: boolean;
  controls: VideoPlayerControls;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const title = video.metadata.title ?? video.url;
  const details = [
    video.isInternalVideo ? "Uploaded" : "YouTube",
    (video.metadata.duration ?? 0) > 0
      ? formatDuration(video.metadata.duration!)
      : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid="playlist-video"
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
        onClick={() => controls.toggleVideo(video.id)}
        aria-label={`${isPlaying ? "Pause" : "Play"} ${title}`}
      >
        {isPlaying ? <FaPause /> : <FaPlay />}
      </Button>
      {/* Narrow screens need the room for the title */}
      <VideoThumbnail video={video} className="hidden w-16 @sm:block" />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-xs text-secondary">{details}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => controls.removeVideo(video.id)}
        aria-label="Remove"
      >
        <IoMdClose />
      </Button>
    </div>
  );
};
