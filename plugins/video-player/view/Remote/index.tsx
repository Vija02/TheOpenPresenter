import { Button, Input, Stack, Text, useDisclosure } from "@chakra-ui/react";
import { OverlayToggle, PluginScaffold, VolumeBar } from "@repo/ui";
import { useState } from "react";
import { MdCloudUpload } from "react-icons/md";
import ReactPlayer from "react-player/lazy";
import "react-scrubber/lib/scrubber.css";
import { typeidUnboxed } from "typeid-js";

import { usePluginAPI } from "../pluginApi";
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

const VideoPlayerRemote = () => {
  const pluginApi = usePluginAPI();

  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  const videos = pluginApi.scene.useData((x) => x.pluginData.videos);
  const volume = pluginApi.renderer.useData((x) => x.volume);

  const [input, setInput] = useState("");
  const [isError, setIsError] = useState(false);

  const onSearch = () => {
    const reactPlayerCanPlay = ReactPlayer.canPlay(input);

    if (reactPlayerCanPlay) {
      mutableSceneData.pluginData.videos.push({
        id: typeidUnboxed("video"),
        metadata: {},
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
            <Button
              size="xs"
              bg="transparent"
              color="white"
              border="1px solid #ffffff6b"
              _hover={{ bg: "rgba(255, 255, 255, 0.13)" }}
              onClick={onToggle}
            >
              <MdCloudUpload /> <Text ml={2}>Upload video</Text>
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

          <Stack flex={1} dir="column" p={3} overflow="auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearch();
              }}
            >
              <Text fontSize="md" fontWeight="bold" mb={1}>
                Search or enter URL:
              </Text>
              <Stack direction="row">
                <Input
                  placeholder="Search..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <Button type="submit" colorScheme="green">
                  Go
                </Button>
              </Stack>
              {isError && <Text color="red">Unable to load this video</Text>}
            </form>

            <YoutubeSearchModal
              {...disclosureProps}
              searchQuery={input}
              onVideoSelect={(videoId) => {
                mutableSceneData.pluginData.videos.push({
                  id: typeidUnboxed("video"),
                  metadata: {},
                  url: `https://www.youtube.com/watch?v=${videoId}`,
                });
                setIsError(false);
                setInput("");
              }}
            />

            <Text fontSize="lg" mt={2} fontWeight="bold">
              Loaded Videos
            </Text>
            {videos.length === 0 && (
              <Text color="gray.600">No videos loaded yet.</Text>
            )}
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </Stack>
        </>
      }
    />
  );
};

export default VideoPlayerRemote;
