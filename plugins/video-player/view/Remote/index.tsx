import {
  Button,
  Input,
  OverlayToggle,
  PluginScaffold,
  VolumeBar,
  useDisclosure,
} from "@repo/ui";
import { useState } from "react";
import { MdCloudUpload } from "react-icons/md";
import ReactPlayer from "react-player/lazy";
import "react-scrubber/lib/scrubber.css";
import { typeidUnboxed } from "typeid-js";

import type { Video } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
// import { trpc } from "../trpc";
import UploadVideoModal from "./UploadVideoModal";
import VideoCard from "./VideoCard";
import YoutubeSearchModal from "./YoutubeSearchModal";
import "./index.css";

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

  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  const videos = pluginApi.scene.useData((x) => x.pluginData.videos);
  const volume = pluginApi.renderer.useData((x) => x.volume);

  const [input, setInput] = useState("");
  const [isError, setIsError] = useState(false);

  // const { refetch: getRes } = trpc.videoPlayer.youtubeMetadata.useQuery(
  //   { ytVideoUrl: input },
  //   { enabled: false },
  // );

  const onSearch = async () => {
    const reactPlayerCanPlay = ReactPlayer.canPlay(input);

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
      mutableSceneData.pluginData.videos.push({
        id: typeidUnboxed("video"),
        metadata,
        url: input,
      });
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

  return (
    <PluginScaffold
      title="Video Player"
      toolbar={
        <OverlayToggle
          toggler={({ onToggle }) => (
            <Button size="xs" variant="pill" onClick={onToggle}>
              <MdCloudUpload /> Upload video
            </Button>
          )}
        >
          <UploadVideoModal />
        </OverlayToggle>
      }
      body={
        <>
          <VolumeBar
            volume={volume}
            onChange={(v) => {
              mutableRendererData.volume = v;
            }}
          />

          <div className="stack-col items-stretch w-full flex-1 p-3 overflow-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearch();
              }}
            >
              <div className="text-lg font-bold mb-1">Search or enter URL:</div>
              <div className="stack-row">
                <Input
                  className="flex-1"
                  placeholder="Search..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <Button type="submit" variant="success">
                  Go
                </Button>
              </div>
              {isError && (
                <div className="text-fill-destructive">
                  Unable to load this video
                </div>
              )}
            </form>

            <YoutubeSearchModal
              isOpen={disclosureProps.open}
              onToggle={disclosureProps.onToggle}
              searchQuery={input}
              onVideoSelect={(videoId, metadata) => {
                mutableSceneData.pluginData.videos.push({
                  id: typeidUnboxed("video"),
                  metadata: {
                    title: metadata.title,
                    duration: metadata.duration,
                    thumbnailUrl: metadata.thumbnailUrl,
                  },
                  url: `https://www.youtube.com/watch?v=${videoId}`,
                });
                setIsError(false);
                setInput("");
              }}
            />

            <div className="text-lg mt-2 font-bold">Loaded Videos</div>
            {videos.length === 0 && (
              <div className="text-secondary">No videos loaded yet.</div>
            )}
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </>
      }
    />
  );
};

export default VideoPlayerRemote;
