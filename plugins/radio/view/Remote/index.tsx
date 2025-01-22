import { Box, Button, Link, Stack, Text } from "@chakra-ui/react";
import { PluginScaffold, VolumeBar } from "@repo/ui";
import { FaPause, FaPlay } from "react-icons/fa6";

import { usePluginAPI } from "../pluginApi";

// TODO: Pull from API
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
    <PluginScaffold
      title="Radio"
      toolbar={
        <>
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
        </>
      }
      body={
        <>
          <VolumeBar
            volume={volume}
            onChange={(v) => {
              mutableRendererData.volume = v;
            }}
          />

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
                  <Link fontSize="xs" href={radio.webLink} isExternal>
                    Link
                  </Link>
                </Box>
              </Stack>
            ))}
          </Stack>
        </>
      }
    />
  );
};

export default RadioRemote;
