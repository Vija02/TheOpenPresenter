import {
  Box,
  Button,
  Grid,
  Heading,
  Slider,
  SliderFilledTrack,
  SliderMark,
  SliderThumb,
  SliderTrack,
  Stack,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import { FaStop } from "react-icons/fa";

import { usePluginAPI } from "../pluginApi";

const WorshipPadsRemote = () => {
  const pluginApi = usePluginAPI();

  const files = pluginApi.scene.useData((x) => x.pluginData.files);
  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const volume = pluginApi.renderer.useData((x) => x.volume);
  const currentKey = pluginApi.renderer.useData((x) => x.currentKey);

  const mutableRendererData = pluginApi.renderer.useValtioData();

  const orientation = useBreakpointValue({
    base: "vertical",
    md: "horizontal",
  }) as "vertical" | "horizontal";

  return (
    <Stack dir="column" p={3}>
      <Heading>Worship Pads</Heading>

      <Box>
        <Grid
          maxW="1200px"
          gap="1px"
          border="1px solid black"
          bg="black"
          gridTemplateColumns={{
            base: "repeat(3, 1fr)",
            md: "repeat(4, 1fr)",
            lg: "repeat(6, 1fr)",
          }}
        >
          {files.map((file) => (
            <Button
              width="100%"
              height="100%"
              rounded="none"
              aspectRatio={1}
              bg={isPlaying && currentKey === file.key ? "blue.200" : "white"}
              _hover={{ bg: "blue.100" }}
              onClick={() => {
                mutableRendererData.currentKey = file.key;
                mutableRendererData.isPlaying = true;
              }}
            >
              {file.key}
            </Button>
          ))}
        </Grid>
      </Box>

      {isPlaying && (
        <Button
          onClick={() => {
            mutableRendererData.isPlaying = false;
          }}
          colorScheme="orange"
        >
          <FaStop />
          <Text ml={2}>Stop</Text>
        </Button>
      )}

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

export default WorshipPadsRemote;
