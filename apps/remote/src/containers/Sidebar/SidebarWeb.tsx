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
import { MdCoPresent } from "react-icons/md";
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
        <Box
          display="flex"
          flexDir="column"
          bg="#F9FBFF"
          height="100%"
          borderRight="1px solid #d0d0d0"
        >
          <Box display="flex" flexDir="column" flex={1} overflow="auto">
            <Link
              href={`/o/${orgSlug}`}
              display="flex"
              height="40px"
              alignItems="center"
              justifyContent="center"
              _hover={{ bg: "gray.300" }}
              bg="white"
            >
              <VscArrowLeft fontSize={20} /> Back to Projects
            </Link>
            <Divider />
            <Box overflow="auto">
              {sortBy(
                Object.entries(data.data),
                ([, value]) => value.order,
              ).map(([id, value]) => (
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
                  position="relative"
                >
                  {data.renderer["1"]?.currentScene === id && (
                    <Box
                      top={0}
                      bottom={0}
                      left={0}
                      width="3px"
                      position="absolute"
                      bg="red.400"
                    />
                  )}
                  <Text fontWeight="bold">{value.name}</Text>
                </Box>
              ))}
            </Box>
            <Stack mt={3} px={2}>
              <OverlayToggle
                toggler={({ onToggle }) => (
                  <Button onClick={onToggle} colorScheme="green">
                    <VscAdd />{" "}
                    <Text ml={2} color="white">
                      Add New Scene
                    </Text>
                  </Button>
                )}
              >
                <SidebarAddSceneModal />
              </OverlayToggle>
              <Link
                href={`/render/${orgSlug}/${projectSlug}`}
                isExternal
                bg="white"
              >
                <Button w="100%" variant="outline" borderColor="gray.300">
                  <MdCoPresent />
                  <Text ml={2}>Present</Text>
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
            {import.meta.env.DEV && (
              <OverlayToggle
                toggler={({ onToggle }) => (
                  <Button
                    onClick={onToggle}
                    colorScheme="green"
                    size="sm"
                    rounded="none"
                  >
                    Debug
                  </Button>
                )}
              >
                <DebugDrawer />
              </OverlayToggle>
            )}
          </Stack>
        </Box>
      </ResizableBoxWrapper>
    </Box>
  );
};
export default SidebarWeb;
