import { Button, Heading, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import ReactPlayer from "react-player/lazy";
import "react-scrubber/lib/scrubber.css";
import { typeidUnboxed } from "typeid-js";

import { usePluginAPI } from "../pluginApi";
import VideoCard from "./VideoCard";
import "./index.css";

const VideoPlayerRemote = () => {
  const pluginApi = usePluginAPI();

  const mutableSceneData = pluginApi.scene.useValtioData();

  const videos = pluginApi.scene.useData((x) => x.pluginData.videos);

  const [videoUrl, setVideoUrl] = useState("");
  const [isError, setIsError] = useState(false);

  return (
    <Stack dir="column" p={3}>
      <Heading>Video Player</Heading>

      <Stack direction="row">
        <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
        <Button
          onClick={() => {
            const reactPlayerCanPlay = ReactPlayer.canPlay(videoUrl);

            if (reactPlayerCanPlay) {
              mutableSceneData.pluginData.videos.push({
                id: typeidUnboxed("video"),
                metadata: {},
                url: videoUrl,
              });
              setIsError(false);
            } else {
              setIsError(true);
            }
          }}
        >
          Add Video
        </Button>
      </Stack>
      {isError && <Text color="red">Unable to load this video</Text>}

      <Text fontSize="lg" mt={2} fontWeight="bold">
        Loaded Videos
      </Text>
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </Stack>
  );
};

export default VideoPlayerRemote;
