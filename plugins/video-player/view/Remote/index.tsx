import {
  Box,
  Button,
  Flex,
  Input,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";
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
    <Flex flexDir="column" height="100%">
      <Box p={3} bg="gray.900">
        <Stack direction="row" alignItems="center" gap={5}>
          <Stack direction="row" alignItems="center">
            <Text fontWeight="bold" color="white">
              <Text>Video Player</Text>
            </Text>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={2}>
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
          </Stack>
        </Stack>
      </Box>
      <Flex width="100%" height="100%">
        <Flex
          flexDirection="column"
          gap={2}
          w="40px"
          px="5px"
          py={4}
          bg="#313131"
          alignItems="center"
        >
          <Text color="white" fontSize="1xs" fontWeight="bold">
            VOL
          </Text>
          <Slider
            id="slider"
            value={volume ?? 1}
            min={0}
            max={1}
            step={0.01}
            orientation="vertical"
            onChange={(v) => {
              mutableRendererData.volume = v;
            }}
            mb={4}
            mt={10}
            flex={1}
          >
            <SliderTrack
              w={2}
              bg="black"
              border="1px solid rgb(255, 255, 255, 0.3)"
            >
              <SliderFilledTrack bg="rgb(130, 130, 130)" />
            </SliderTrack>
            <SliderThumb
              rounded="5px"
              width="30px"
              height="50px"
              bg="linear-gradient(#282828 0%, #323232 45%, white 45%, white 55%, #383838 55%, #494949 100%)"
              border="1px solid #ffffff1c"
              borderTop="1px solid rgba(255, 255, 255, 0.32)"
              boxShadow="rgba(0, 0, 0, 0.75) 2px 4px 5px 0px"
            />
          </Slider>
        </Flex>

        <Stack flex={1} dir="column" p={3}>
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
      </Flex>
    </Flex>
  );
};

export default VideoPlayerRemote;
