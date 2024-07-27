import { Box, Button, Heading } from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";

import { pluginApi } from "../../util";
import MWLSongView from "../MWLSongView";
import MWLRemoteCustomAddSongModal from "./MWLRemoteCustomAddSongModal";

const MWLRemoteCustom = () => {
  const songIds = pluginApi.scene.useData((x) => x.pluginData.songIds);

  return (
    <Box p={3}>
      <Heading>MWL REMOTE</Heading>
      {/* <Box p={2} my={2} bg="gray.100">
        <Text fontWeight="bold" fontSize="xs">
          DEBUG
        </Text>
        <Text color="gray.600">{JSON.stringify(d)}</Text>
      </Box> */}
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
