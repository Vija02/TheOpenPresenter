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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Button,
  Input,
  PluginScaffold,
  VolumeBar,
  useDisclosure,
} from "@repo/ui";
import { Video } from "@repo/video";
import { canPlay, useComputedPlaybackState } from "@repo/video/client";
import { useCallback, useMemo, useState } from "react";
import { FaPause, FaPlay } from "react-icons/fa6";
import { VscLibrary } from "react-icons/vsc";
import "react-scrubber/lib/scrubber.css";
import { typeidUnboxed } from "typeid-js";

import { usePluginAPI } from "../pluginApi";
import { useVideoSequence } from "../useVideoSequence";
import { NowPlaying } from "./NowPlaying";
import { VideoRow } from "./VideoRow";
import YoutubeSearchModal from "./YoutubeSearchModal";
import "./index.css";
import { useVideoPlayerControls } from "./useVideoPlayerControls";

function isValidHttpUrl(string: string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

// Taken from react-player /src/patterns
export const MATCH_URL_YOUTUBE =
  /(?:youtu\.be\/|youtube(?:-nocookie|education)?\.com\/(?:embed\/|v\/|watch\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))((\w|-){11})|youtube\.com\/playlist\?list=|youtube\.com\/user\//;

const VideoPlayerRemote = () => {
  const pluginApi = usePluginAPI();

  const mutableRendererData = pluginApi.renderer.useValtioData();

  const videos = pluginApi.scene.useData((x) => x.pluginData.videos);
  const videoStates = pluginApi.renderer.useData((x) => x.videoStates);
  const autoplay = pluginApi.renderer.useData((x) => x.autoplay) ?? false;

  const current = useVideoSequence();
  const controls = useVideoPlayerControls();

  const currentVideo = useMemo(
    () => videos.find((x) => x.id === current.videoId) ?? null,
    [current.videoId, videos],
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = videos.map((x) => x.id);
    controls.moveVideo(
      ids.indexOf(active.id as string),
      ids.indexOf(over.id as string),
    );
  };

  // Only whether it's playing, so a slow tick is plenty
  const { isPlaying } = useComputedPlaybackState(
    current.playbackState,
    currentVideo?.metadata.duration,
    1000,
  );

  // Get volume from first video state (they all share the same volume)
  const firstVideoState = Object.values(videoStates)[0];
  const volume = firstVideoState?.volume ?? null;

  const [input, setInput] = useState("");
  const [isError, setIsError] = useState(false);

  // Update volume for all video states
  const onVolumeChange = useCallback(
    (v: number) => {
      for (const videoId of Object.keys(mutableRendererData.videoStates)) {
        mutableRendererData.videoStates[videoId]!.volume = v;
      }
    },
    [mutableRendererData],
  );

  // const { refetch: getRes } = trpc.videoPlayer.youtubeMetadata.useQuery(
  //   { ytVideoUrl: input },
  //   { enabled: false },
  // );

  const onSearch = async () => {
    const reactPlayerCanPlay = canPlay(input);

    const metadata: Video["metadata"] = {};

    // const isYoutube = MATCH_URL_YOUTUBE.test(input);
    // if (isYoutube) {
    //   try {
    //     const ytMetadata = await getRes();
    //     if (!ytMetadata.data) throw ytMetadata.error;

    //     metadata = {
    //       title: ytMetadata.data.title,
    //       duration: ytMetadata.data.duration,
    //       thumbnailUrl: ytMetadata.data.thumbnailUrl,
    //     };
    //   } catch (err) {
    //     pluginApi.log.error(
    //       { err, url: input },
    //       "Failed to extract youtube metadata",
    //     );
    //   }
    // }

    if (reactPlayerCanPlay) {
      controls.addVideos([
        { id: typeidUnboxed("video"), metadata, url: input },
      ]);
      setIsError(false);
      setInput("");
    } else if (isValidHttpUrl(input)) {
      setIsError(true);
    } else {
      disclosureProps.onOpen();
      setIsError(false);
    }
  };
  const disclosureProps = useDisclosure();

  const handleMediaPicker = useCallback(async () => {
    const results = await pluginApi.mediaPicker.show({
      type: "video",
      title: "Select Video",
      autoPickVideo: true,
    });

    const internalVideos = (results ?? [])
      .map((x) => x.internalVideo)
      .filter((x) => !!x);
    if (internalVideos.length > 0) controls.addVideos(internalVideos);
  }, [pluginApi.mediaPicker, controls]);

  return (
    <PluginScaffold
      title="Video Player"
      toolbar={
        <div className="stack-row gap-2">
          <Button
            size="xs"
            variant="pill"
            onClick={controls.togglePlayback}
            disabled={videos.length === 0}
            aria-label={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? <FaPause /> : <FaPlay />}
          </Button>
          <Button
            size="xs"
            variant="pill"
            onClick={handleMediaPicker}
            title="Media library"
          >
            <VscLibrary />
            Media library
          </Button>
        </div>
      }
      body={
        <>
          {volume !== null && (
            <VolumeBar volume={volume} onChange={onVolumeChange} />
          )}

          <div className="@container stack-col items-stretch flex-1 p-3 overflow-auto">
            {currentVideo && current.playbackState && (
              <NowPlaying
                video={currentVideo}
                playbackState={current.playbackState}
                autoplay={autoplay}
                repeatMode={current.repeatMode}
                controls={controls}
              />
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearch();
              }}
            >
              <div className="stack-row">
                <Input
                  className="flex-1 min-w-0"
                  placeholder="Search YouTube or paste a link..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <Button type="submit" variant="success">
                  Go
                </Button>
              </div>
              {isError && (
                <div className="text-fill-destructive mt-1">
                  Unable to load this video
                </div>
              )}
            </form>

            <YoutubeSearchModal
              isOpen={disclosureProps.open}
              onToggle={disclosureProps.onToggle}
              searchQuery={input}
              onVideoSelect={(videoId, metadata) => {
                controls.addVideos([
                  {
                    id: typeidUnboxed("video"),
                    metadata: {
                      title: metadata.title,
                      duration: metadata.duration,
                      thumbnailUrl: metadata.thumbnailUrl,
                    },
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                  },
                ]);
                setIsError(false);
                setInput("");
              }}
            />

            {videos.length === 0 && (
              <div className="text-secondary py-4">
                No videos loaded yet. Search YouTube or paste a link to add one.
              </div>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={videos.map((x) => x.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="stack-col items-stretch gap-1 mt-2">
                  {videos.map((video) => (
                    <VideoRow
                      key={video.id}
                      video={video}
                      isActive={video.id === current.videoId}
                      isPlaying={video.id === current.videoId && isPlaying}
                      controls={controls}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </>
      }
    />
  );
};

export default VideoPlayerRemote;
