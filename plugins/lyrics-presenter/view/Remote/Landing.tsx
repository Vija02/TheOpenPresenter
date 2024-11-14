import { Button, Center, Heading, Stack, Text } from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";
import { VscAdd } from "react-icons/vsc";

import RemoteAddSongModal from "./RemoteAddSongModal";

const Landing = () => {
  return (
    <Center mt={10} p={2}>
      <Stack>
        <Heading textAlign="center" mb={4}>
          Welcome to Lyrics Presenter
        </Heading>

        <Text textAlign="center" mb={4} fontSize="md" color="gray.500">
          Song list empty. Add a new song to start presenting.
        </Text>

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
              colorScheme="green"
            >
              <VscAdd />
              <Text ml={2}>Add a song to the list</Text>
            </Button>
          )}
        >
          <RemoteAddSongModal />
        </OverlayToggle>
      </Stack>
    </Center>
  );
};
export default Landing;
