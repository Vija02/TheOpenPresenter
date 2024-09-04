import {
  Box,
  Button,
  Heading,
  Slider,
  SliderFilledTrack,
  SliderMark,
  SliderThumb,
  SliderTrack,
  Stack,
  useBreakpointValue,
} from "@chakra-ui/react";

import { usePluginAPI } from "../pluginApi";

const a = "https://s3.radio.co/sd16d576db/listen";
const b = "https://worship247.streamguys1.com/live-mp3-web";

const RadioRemote = () => {
  const pluginApi = usePluginAPI();
  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const volume = pluginApi.renderer.useData((x) => x.volume);
  const mutableRendererData = pluginApi.renderer.useValtioData();

  const orientation = useBreakpointValue({
    base: "vertical",
    md: "horizontal",
  }) as "vertical" | "horizontal";

  return (
    <Stack dir="column" p={3}>
      <Heading>Radio</Heading>

      <Button
        onClick={() => {
          mutableRendererData.isPlaying = !isPlaying;
        }}
      >
        {!isPlaying ? "Play" : "Pause"}
      </Button>
      <Box>
        <Slider
          key={orientation}
          id="slider"
          value={volume ?? 1}
          min={0}
          max={1}
          step={0.01}
          orientation={orientation}
          colorScheme="teal"
          onChange={(v) => {
            mutableRendererData.volume = v;
          }}
          height={{ base: "70vh", md: "100%" }}
          width={{ base: "80px", md: "100%" }}
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
    </Stack>
  );
};

export default RadioRemote;
