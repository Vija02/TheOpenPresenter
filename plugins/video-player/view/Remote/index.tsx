import {
  Box,
  Button,
  Heading,
  Input,
  Slider,
  SliderFilledTrack,
  SliderMark,
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
    <Stack dir="column" p={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Heading>Video Player</Heading>
        <OverlayToggle
          toggler={({ onToggle }) => (
            <Button
              onClick={onToggle}
              size="sm"
              bg="black"
              color="white"
              display="flex"
              gap={2}
              _hover={{ bg: "gray.800" }}
            >
              <MdCloudUpload /> <Text>Upload video</Text>
            </Button>
          )}
        >
          <UploadVideoModal />
        </OverlayToggle>
      </Stack>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
      >
        <Stack direction="row">
          <Input
            placeholder="Search or Enter Video/Youtube/Vimeo/Etc URL"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" colorScheme="green">
            Search/Add
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

      <Box>
        <Slider
          id="slider"
          value={volume ?? 1}
          min={0}
          max={1}
          step={0.01}
          colorScheme="teal"
          onChange={(v) => {
            mutableRendererData.volume = v;
          }}
          height="100%"
          width="100%"
        >
          <SliderMark value={0.25} mt="1" ml="-2.5" fontSize="sm">
            25%
          </SliderMark>
          <SliderMark value={0.5} mt="1" ml="-2.5" fontSize="sm">
            50%
          </SliderMark>
          <SliderMark value={0.75} mt="1" ml="-2.5" fontSize="sm">
            75%
          </SliderMark>
          <SliderTrack>
            <SliderFilledTrack />
          </SliderTrack>
          <SliderThumb />
        </Slider>
      </Box>

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
