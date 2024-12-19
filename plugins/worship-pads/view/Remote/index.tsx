import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Stack,
  Text,
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

  return (
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

      <Stack dir="column" p={3} flex={1}>
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
      </Stack>
    </Flex>
  );
};

export default WorshipPadsRemote;
