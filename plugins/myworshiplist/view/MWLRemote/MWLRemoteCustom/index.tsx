import { Box, Button, Heading, Text } from "@chakra-ui/react";
import {
  useMutablePluginData,
  useSnapshotPluginData,
} from "@repo/base-plugin/client";
import { OverlayToggle } from "@repo/ui";

import { CustomData } from "../../../src/types";
import MWLRemoteCustomAddSongModal from "./MWLRemoteCustomAddSongModal";

const MWLRemoteCustom = () => {
  const d = useSnapshotPluginData<CustomData>();
  const mutableData = useMutablePluginData<CustomData>();

  return (
    <Box p={3}>
      <Heading>MWL REMOTE</Heading>
      <Box p={2} my={2} bg="gray.100">
        <Text fontWeight="bold" fontSize="xs">
          DEBUG
        </Text>
        <Text color="gray.600">{JSON.stringify(d)}</Text>
      </Box>
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
