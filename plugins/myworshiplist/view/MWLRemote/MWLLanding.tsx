import { Box, Button, Text } from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";
import { VscAdd } from "react-icons/vsc";

import MWLRemoteAddSongModal from "./MWLRemoteAddSongModal";

const MWLLanding = () => {
  return (
    <Box>
      <Text>Landing</Text>
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
    </Box>
  );
};
export default MWLLanding;
