import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";
import { VscAdd, VscPaintcan } from "react-icons/vsc";

import { usePluginAPI } from "../pluginApi";
import MWLRemoteAddSongModal from "./MWLRemoteAddSongModal";
import MWLStyleSettingModal from "./MWLStyleSettingModal";
import SongView from "./SongView";

const MWLRemote = () => {
  const pluginApi = usePluginAPI();
  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);

  return (
    <Box>
      <Box p={3} bg="gray.900">
        <Stack direction="row" alignItems="center" gap={5}>
          <Stack direction="row" alignItems="center">
            <Text fontWeight="bold" color="white">
              <Text>Lyrics</Text>
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
                  <VscAdd />
                  <Text ml={1} fontWeight="normal" fontSize="xs">
                    Add
                  </Text>
                </Button>
              )}
            >
              <MWLRemoteAddSongModal />
            </OverlayToggle>
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
                  <VscPaintcan />{" "}
                  <Text ml={1} fontWeight="normal" fontSize="xs">
                    Style
                  </Text>
                </Button>
              )}
            >
              <MWLStyleSettingModal />
            </OverlayToggle>
          </Stack>
        </Stack>
      </Box>

      <Box p={3}>
        {songs.map((song) => (
          <SongView key={song.id} song={song} />
        ))}
        <OverlayToggle
          toggler={({ onToggle }) => (
            <Button
              size="sm"
              colorScheme="green"
              cursor="pointer"
              onClick={onToggle}
            >
              <VscAdd />
              <Text ml={2}>Add Song</Text>
            </Button>
          )}
        >
          <MWLRemoteAddSongModal />
        </OverlayToggle>
      </Box>
    </Box>
  );
};

export default MWLRemote;
