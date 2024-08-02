import { Box, Button, Divider, Heading, Text } from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";
import { sortBy } from "lodash";
import { useLocation } from "wouter";

import { useData } from "../../yjs";
import SidebarAddSceneModal from "./SidebarAddSceneModal";

const Sidebar = () => {
  const data = useData();
  const [location, navigate] = useLocation();

  return (
    <Box bg="gray.100">
      <Heading fontSize="lg" mb={3} p={2}>
        TheOpenPresenter Remote
      </Heading>
      <Divider />
      {sortBy(Object.entries(data.data), ([, value]) => value.order).map(
        ([id, value]) => (
          <Box
            key={id}
            onClick={() => {
              navigate(`/${id}`);
            }}
            cursor="pointer"
            px={2}
            _hover={{ bg: "gray.300" }}
            bg={location.includes(id) ? "gray.300" : "transparent"}
          >
            <Text fontWeight="bold">
              {value.name}
              <Text as="i" color="gray.800" fontWeight="normal">
                ({value.type})
              </Text>
            </Text>
          </Box>
        ),
      )}
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
            +
          </Button>
        )}
      >
        <SidebarAddSceneModal />
      </OverlayToggle>
    </Box>
  );
};
export default Sidebar;
