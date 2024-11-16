import { Alert, Button, Heading, Text, VStack } from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";
import { VscAdd } from "react-icons/vsc";

import SidebarAddSceneModal from "./Sidebar/SidebarAddSceneModal";

export const EmptyScene = () => {
  return (
    <VStack p={3} alignItems="start">
      <Heading>Add a scene</Heading>
      <Text>
        There is no scene in your project yet. Add one now to start presenting.
      </Text>
      <OverlayToggle
        toggler={({ onToggle }) => (
          <Button cursor="pointer" onClick={onToggle} colorScheme="green">
            <VscAdd />
            <Text ml={2} color="white">
              Add Scene
            </Text>
          </Button>
        )}
      >
        <SidebarAddSceneModal />
      </OverlayToggle>
      <Alert status="info">
        Afterwards, click on the "Present" on the device you want the
        presentation to be shown.
      </Alert>
    </VStack>
  );
};
