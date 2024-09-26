import { Box, Button, Heading } from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";
import { VscAdd, VscSettingsGear } from "react-icons/vsc";

import { usePluginAPI } from "../pluginApi";
import MWLRemoteAddSongModal from "./MWLRemoteAddSongModal";
import MWLStyleSettingModal from "./MWLStyleSettingModal";
import SongView from "./SongView";

const MWLRemote = () => {
  const pluginApi = usePluginAPI();
  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);

  return (
    <Box p={3}>
      <Heading>MWL REMOTE</Heading>
      <OverlayToggle
        toggler={({ onToggle }) => (
          <Button
            p={1}
            _hover={{
              bgColor: "blue.500",
              color: "white",
            }}
            cursor="pointer"
            onClick={onToggle}
          >
            <VscAdd />
          </Button>
        )}
      >
        <MWLRemoteAddSongModal />
      </OverlayToggle>
      <OverlayToggle
        toggler={({ onToggle }) => (
          <Button
            p={1}
            _hover={{
              bgColor: "blue.500",
              color: "white",
            }}
            cursor="pointer"
            onClick={onToggle}
          >
            <VscSettingsGear />
          </Button>
        )}
      >
        <MWLStyleSettingModal />
      </OverlayToggle>

      {songs.map((song) => (
        <SongView key={song.id} song={song} />
      ))}
      <OverlayToggle
        toggler={({ onToggle }) => (
          <Button
            p={1}
            _hover={{
              bgColor: "blue.500",
              color: "white",
            }}
            cursor="pointer"
            onClick={onToggle}
          >
            Add Song
          </Button>
        )}
      >
        <MWLRemoteAddSongModal />
      </OverlayToggle>
    </Box>
  );
};

export default MWLRemote;
