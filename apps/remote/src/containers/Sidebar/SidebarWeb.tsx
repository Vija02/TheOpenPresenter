import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Divider,
  Link,
  Stack,
  Text,
} from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";
import { sortBy } from "lodash-es";
import { VscAdd, VscArrowLeft } from "react-icons/vsc";
import { useLocation } from "wouter";

import { useAwareness } from "../../contexts/AwarenessProvider";
import { useData } from "../../contexts/PluginDataProvider";
import { usePluginMetaData } from "../../contexts/PluginMetaDataProvider";
import DebugDrawer from "./Debug/DebugDrawer";
import { ResizableBoxWrapper } from "./ResizableBoxWrapper";
import SidebarAddSceneModal from "./SidebarAddSceneModal";

const SidebarWeb = () => {
  const data = useData();
  const [location, navigate] = useLocation();
  const { orgSlug, projectSlug } = usePluginMetaData();
  const { awarenessData } = useAwareness();

  return (
    <Box boxShadow="md">
      <ResizableBoxWrapper>
        <Box display="flex" flexDir="column" bg="gray.100" height="100%">
          <Box flex={1}>
            <Link
              href={`/o/${orgSlug}`}
              display="flex"
              height="40px"
              alignItems="center"
              justifyContent="center"
              _hover={{ bg: "gray.300" }}
            >
              <VscArrowLeft fontSize={20} /> Back to Projects
            </Link>
            <Divider />
            {sortBy(Object.entries(data.data), ([, value]) => value.order).map(
              ([id, value]) => (
                <Box
                  key={id}
                  onClick={() => {
                    navigate(`/${id}`);
                  }}
                  cursor="pointer"
                  py={2}
                  px={2}
                  _hover={{ bg: "gray.300" }}
                  bg={location.includes(id) ? "gray.300" : "transparent"}
                >
                  <Text fontWeight="bold">{value.name}</Text>
                </Box>
              ),
            )}
            <Stack mt={3} px={2}>
              <OverlayToggle
                toggler={({ onToggle }) => (
                  <Button onClick={onToggle} colorScheme="green">
                    <VscAdd /> Add New Scene
                  </Button>
                )}
              >
                <SidebarAddSceneModal />
              </OverlayToggle>
              <Link href={`/render/${orgSlug}/${projectSlug}`} isExternal>
                <Button w="100%" variant="outline">
                  Open Renderer
                </Button>
              </Link>
            </Stack>
          </Box>
          <Stack p={2}>
            <Text>Remote</Text>
            <AvatarGroup>
              {awarenessData
                .filter((x) => x.user.type === "remote")
                .map((x, i) => (
                  <Avatar key={i} size="sm" name={x.user.type} />
                ))}
            </AvatarGroup>
            <Text>Renderer</Text>
            <AvatarGroup>
              {awarenessData
                .filter((x) => x.user.type === "renderer")
                .map((x, i) => (
                  <Avatar key={i} size="sm" name={x.user.type} />
                ))}
            </AvatarGroup>
          </Stack>
          <Stack>
            <OverlayToggle
              toggler={({ onToggle }) => (
                <Button onClick={onToggle} colorScheme="green">
                  Debug
                </Button>
              )}
            >
              <DebugDrawer />
            </OverlayToggle>
          </Stack>
        </Box>
      </ResizableBoxWrapper>
    </Box>
  );
};
export default SidebarWeb;
