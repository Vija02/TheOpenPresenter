import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { OverlayToggle, PluginScaffold } from "@repo/ui";
import { VscAdd, VscPaintcan } from "react-icons/vsc";

import { usePluginAPI } from "../pluginApi";
import RemoteAddSongModal from "./RemoteAddSongModal";
import SongView from "./SongView";
import StyleSettingModal from "./StyleSettingModal";

const Remote = () => {
  const pluginApi = usePluginAPI();
  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);

  return (
    <PluginScaffold
      title="Lyrics"
      toolbar={
        <>
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
            <RemoteAddSongModal />
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
            <StyleSettingModal />
          </OverlayToggle>
        </>
      }
      body={
        <Box p={3} w="100%">
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
            <RemoteAddSongModal />
          </OverlayToggle>
        </Box>
      }
    />
  );
};

export default Remote;
