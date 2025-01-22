import {
  Box,
  Button,
  Grid,
  Text
} from "@chakra-ui/react";
import { PluginScaffold, VolumeBar } from "@repo/ui";
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
    <PluginScaffold
      title="Worship Pads"
      body={
        <>
          <VolumeBar
            volume={volume}
            onChange={(v) => {
              mutableRendererData.volume = v;
            }}
          />
          <Box p={3} width="100%">
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
                    bg={
                      isPlaying && currentKey === file.key
                        ? "blue.200"
                        : "white"
                    }
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
                width="100%"
                mt={3}
                colorScheme="orange"
              >
                <FaStop />
                <Text ml={2}>Stop</Text>
              </Button>
            )}
          </Box>
        </>
      }
    />
  );
};

export default WorshipPadsRemote;
