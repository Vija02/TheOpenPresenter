import {
  Box,
  Button,
  Flex,
  Link,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FaPause, FaPlay } from "react-icons/fa6";

import { usePluginAPI } from "../pluginApi";

const radios = [
  {
    title: "Worship 24/7 (worship247.com)",
    webLink: "https://worship247.com",
    coverUrl: "",
    url: "https://worship247.streamguys1.com/live-aac",
  },
  {
    title: "Worship Radio 247 (worshipradio247.org)",
    webLink: "https://worshipradio247.org",
    coverUrl: "",
    url: "https://uk3-vn.mixstream.net/:8010/listen.mp3",
  },
  {
    title: "AllWorship Christmas Worship",
    webLink: "https://www.allworship.com",
    coverUrl: "",
    url: "https://ice66.securenetsystems.net/AGCXW",
  },
  {
    title: "AllWorship Instrumental Worship",
    webLink: "https://www.allworship.com",
    coverUrl: "",
    url: "https://ice66.securenetsystems.net/AGCIW",
  },
  {
    title: "AllWorship Contemporary Worship",
    webLink: "https://www.allworship.com",
    coverUrl: "",
    url: "https://ice66.securenetsystems.net/AGCCW",
  },
  {
    title: "AllWorship Praise & Worship",
    webLink: "https://www.allworship.com",
    coverUrl: "",
    url: "https://ice66.securenetsystems.net/AGCPW",
  },
  {
    title: "AllWorship Gospel Worship",
    webLink: "https://www.allworship.com",
    coverUrl: "",
    url: "https://ice25.securenetsystems.net/AGCGW",
  },
  {
    title: "AllWorship Hymns & Favorites",
    webLink: "https://www.allworship.com",
    coverUrl: "",
    url: "https://ice25.securenetsystems.net/AGCHF",
  },
  {
    title: "I Will Gather You Radio",
    webLink: "https://worship247.com",
    coverUrl: "",
    url: "https://s3.radio.co/sd16d576db/listen",
  },
  {
    title: "Power of Worship Radio",
    webLink: "https://www.powerofworship.net",
    coverUrl: "",
    url: "https://stream.aiir.com/rwvbhh4xsgpuv",
  },
];

const RadioRemote = () => {
  const pluginApi = usePluginAPI();
  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const volume = pluginApi.renderer.useData((x) => x.volume);
  const playingUrl = pluginApi.renderer.useData((x) => x.url);
  const mutableRendererData = pluginApi.renderer.useValtioData();

  return (
    <Flex flexDir="column" height="100%">
      <Box p={3} bg="gray.900">
        <Stack direction="row" alignItems="center" gap={5}>
          <Stack direction="row" alignItems="center">
            <Text fontWeight="bold" color="white">
              <Text>Radio</Text>
            </Text>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Button
              size="xs"
              bg="transparent"
              color="white"
              border="1px solid #ffffff6b"
              _hover={{ bg: "rgba(255, 255, 255, 0.13)" }}
              onClick={() => {
                mutableRendererData.isPlaying = !isPlaying;
              }}
              isDisabled={!playingUrl}
            >
              {!isPlaying ? <FaPlay /> : <FaPause />}
            </Button>
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
          <Text color="white" fontSize="3xs">
            Volume
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
            my={4}
            flex={1}
          >
            <SliderTrack w={2} bg="black">
              <SliderFilledTrack bg="rgb(87, 87, 87)" />
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
          {radios.map((radio, i) => (
            <Stack key={i} direction="row">
              <Button
                onClick={() => {
                  if (!isPlaying || playingUrl !== radio.url) {
                    mutableRendererData.isPlaying = true;
                    mutableRendererData.url = radio.url;
                  } else {
                    mutableRendererData.isPlaying = false;
                  }
                }}
              >
                {!isPlaying || playingUrl !== radio.url ? (
                  <FaPlay />
                ) : (
                  <FaPause />
                )}
              </Button>
              <Box>
                <Text fontSize="md">{radio.title}</Text>
                <Link fontSize="xs" href={radio.url} isExternal>
                  Link
                </Link>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Flex>
    </Flex>
  );
};

export default RadioRemote;
