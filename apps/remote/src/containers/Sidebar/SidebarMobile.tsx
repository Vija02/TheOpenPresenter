import { Box, Button, Divider, Link, Stack, Text } from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";
import { sortBy } from "lodash-es";
import { MdCoPresent } from "react-icons/md";
import { VscAdd, VscArrowLeft } from "react-icons/vsc";
import { useLocation } from "wouter";

import { useData } from "../../contexts/PluginDataProvider";
import { usePluginMetaData } from "../../contexts/PluginMetaDataProvider";
import SidebarAddSceneModal from "./SidebarAddSceneModal";

const SidebarMobile = () => {
  const data = useData();
  const [location, navigate] = useLocation();
  const { orgSlug, projectSlug } = usePluginMetaData();

  return (
    <Box boxShadow="md">
      <Box bg="gray.100" height="100%" width="80px">
        <Link
          href={`/o/${orgSlug}`}
          display="flex"
          height="40px"
          alignItems="center"
          justifyContent="center"
          _hover={{ bg: "gray.300" }}
        >
          <VscArrowLeft fontSize={20} />
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
              px={2}
              _hover={{ bg: "gray.300" }}
              bg={location.includes(id) ? "gray.300" : "transparent"}
              height="80px"
              display="flex"
              alignItems="center"
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
              <Text
                fontSize="xs"
                textAlign="center"
                wordBreak="break-word"
                width="100%"
              >
                {value.name}
              </Text>
            </Box>
          ),
        )}
        <Stack mt={3} px={2}>
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
          <Link
            href={`/render/${orgSlug}/${projectSlug}`}
            isExternal
            textDecor="none"
            _hover={{ textDecor: "none" }}
            onClick={(e) => {
              window.open(
                `/render/${orgSlug}/${projectSlug}`,
                "_blank",
                `width=${screen.availWidth},height=${screen.availHeight},toolbar=no,fullscreen=yes,top=0,left=${screen.availWidth}`,
              );
              e.preventDefault();
            }}
          >
            <Button
              w="100%"
              variant="outline"
              display="flex"
              flexDir="column"
              borderColor="gray.300"
            >
              <MdCoPresent />
              <Text fontSize="2xs" fontWeight="normal">
                Present
              </Text>
            </Button>
          </Link>
        </Stack>
      </Box>
    </Box>
  );
};
export default SidebarMobile;
