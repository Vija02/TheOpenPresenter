import {
  Box,
  Button,
  Divider,
  Link,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { PluginRendererState } from "@repo/base-plugin";
import { useAwareness, useData, usePluginMetaData } from "@repo/shared";
import { OverlayToggle } from "@repo/ui";
import { sortBy } from "lodash-es";
import { FaMicrophoneLines as FaMicrophoneLinesRaw } from "react-icons/fa6";
import {
  MdCoPresent as MdCoPresentRaw,
  MdVolumeUp as MdVolumeUpRaw,
} from "react-icons/md";
import { RiRemoteControlLine as RiRemoteControlLineRaw } from "react-icons/ri";
import { VscAdd, VscArrowLeft } from "react-icons/vsc";
import { useLocation } from "wouter";

import DebugDrawer from "./Debug/DebugDrawer";
import { PresentButton } from "./PresentButton";
import { RendererWarning } from "./RendererWarning";
import SidebarAddSceneModal from "./SidebarAddSceneModal";

const MdCoPresent = chakra(MdCoPresentRaw);
const MdVolumeUp = chakra(MdVolumeUpRaw);
const RiRemoteControlLine = chakra(RiRemoteControlLineRaw);
const FaMicrophoneLines = chakra(FaMicrophoneLinesRaw);

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.9); }
`;

const SidebarMobile = () => {
  const data = useData();
  const [location, navigate] = useLocation();
  const { orgSlug, projectSlug } = usePluginMetaData();
  const { awarenessData } = useAwareness();

  return (
    <Box boxShadow="md">
      <Box
        display="flex"
        flexDir="column"
        bg="#F9FBFF"
        height="100%"
        width="80px"
        borderRight="1px solid #d0d0d0"
      >
        <Box display="flex" flexDir="column" flex={1} overflow="auto" pb={2}>
          <Link
            href={`/o/${orgSlug}`}
            display="flex"
            height="40px"
            alignItems="center"
            justifyContent="center"
            _hover={{ bg: "gray.300" }}
            bg="white"
          >
            <VscArrowLeft fontSize={20} />
          </Link>
          <Divider />
          <Box overflow="auto">
            {sortBy(Object.entries(data.data), ([, value]) => value.order).map(
              ([id, value]) => {
                const audioIsPlaying = !!Object.values(
                  data.renderer["1"]?.children[id] ?? {},
                ).find((x: PluginRendererState) => x.__audioIsPlaying);
                const audioIsRecording = !!Object.values(
                  data.renderer["1"]?.children[id] ?? {},
                ).find((x: PluginRendererState) => x.__audioIsRecording);

                const isLoading = awarenessData.find(
                  (x) =>
                    x.user &&
                    x.user.type === "renderer" &&
                    x.user.state.find((y) => y.sceneId === id && y.isLoading),
                );

                return (
                  <Stack
                    key={id}
                    spacing={1}
                    onClick={() => {
                      navigate(`/${id}`);
                    }}
                    cursor="pointer"
                    px={2}
                    _hover={{ bg: "gray.300" }}
                    bg={location.includes(id) ? "gray.300" : "transparent"}
                    height="80px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    position="relative"
                    borderBottom="1px solid rgb(0, 0, 0, 0.06)"
                  >
                    {isLoading && (
                      <Box
                        width="10px"
                        height="10px"
                        rounded="full"
                        bgColor="orange.400"
                        animation={`${pulse} 2s infinite`}
                      />
                    )}
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
                    <Text
                      fontSize="xs"
                      textAlign="center"
                      wordBreak="break-word"
                      width="100%"
                      fontWeight="medium"
                    >
                      {value.name}
                    </Text>
                    <Stack direction="row">
                      {audioIsPlaying && <MdVolumeUp fontSize="lg" />}
                      {audioIsRecording && (
                        <FaMicrophoneLines color="red.500" fontSize="lg" />
                      )}
                    </Stack>
                  </Stack>
                );
              },
            )}
          </Box>
          <Stack py={3} px={2}>
            <OverlayToggle
              toggler={({ onToggle }) => (
                <Button
                  p={1}
                  cursor="pointer"
                  onClick={onToggle}
                  colorScheme="green"
                  display="flex"
                  flexDir="column"
                >
                  <VscAdd />
                  <Text color="white" fontSize="2xs" fontWeight="normal">
                    Add
                  </Text>
                </Button>
              )}
            >
              <SidebarAddSceneModal />
            </OverlayToggle>

            <PresentButton isMobile />
          </Stack>
        </Box>
        <Stack
          direction="column"
          p={2}
          alignItems="center"
          justifyContent="center"
          borderTop="1px solid"
          borderColor="gray.200"
        >
          <Stack direction="row" alignItems="center">
            <Text fontWeight="medium" fontSize="md">
              {awarenessData.filter((x) => x.user?.type === "remote").length}
            </Text>
            <RiRemoteControlLine title="Active remote" fontSize="md" />
          </Stack>
          <Stack direction="row" alignItems="center">
            <Text fontWeight="medium" fontSize="md">
              {awarenessData.filter((x) => x.user?.type === "renderer").length}
            </Text>
            <MdCoPresent title="Active screens" fontSize="md" />
          </Stack>
        </Stack>
        <Stack gap={0}>
          <RendererWarning />
          {import.meta.env.DEV && (
            <OverlayToggle
              toggler={({ onToggle }) => (
                <Button
                  onClick={onToggle}
                  colorScheme="gray"
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
    </Box>
  );
};
export default SidebarMobile;
