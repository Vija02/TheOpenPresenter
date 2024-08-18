import { Box, Button, Heading } from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";
import { VscAdd, VscSettingsGear } from "react-icons/vsc";

import { pluginApi } from "../../util";
import MWLSongView from "../MWLSongView";
import MWLRemoteCustomAddSongModal from "./MWLRemoteCustomAddSongModal";
import MWLStyleSettingModal from "./MWLStyleSettingModal";

const MWLRemoteCustom = () => {
  const songIds = pluginApi.scene.useData((x) => x.pluginData.songIds);

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
        <MWLRemoteCustomAddSongModal />
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

      {songIds.map((songId) => (
        <MWLSongView key={songId} songId={songId} />
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
        <MWLRemoteCustomAddSongModal />
      </OverlayToggle>
    </Box>
  );
};

export default MWLRemoteCustom;
