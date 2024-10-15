import {
  Button,
  Heading,
  Input,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useState } from "react";
import ReactPlayer from "react-player/lazy";
import "react-scrubber/lib/scrubber.css";
import { typeidUnboxed } from "typeid-js";

import { usePluginAPI } from "../pluginApi";
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

  const videos = pluginApi.scene.useData((x) => x.pluginData.videos);

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
      <Heading>Video Player</Heading>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
      >
        <Stack direction="row">
          <Input
            placeholder="Enter Video/Youtube/Vimeo/Etc URL"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit">Search/Add</Button>
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
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </Stack>
  );
};

export default VideoPlayerRemote;
