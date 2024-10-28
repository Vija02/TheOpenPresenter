import { Box, Button, Link, Separator, Stack, Text } from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";
import { sortBy } from "lodash-es";
import { VscAdd, VscArrowLeft, VscLinkExternal } from "react-icons/vsc";
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
        <Separator />
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
            >
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
                _hover={{
                  bgColor: "blue.500",
                  color: "white",
                }}
                cursor="pointer"
                onClick={onToggle}
                colorScheme="green"
              >
                <VscAdd />
              </Button>
            )}
          >
            <SidebarAddSceneModal />
          </OverlayToggle>
          <Link
            href={`/render/${orgSlug}/${projectSlug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button w="100%" variant="outline">
              <VscLinkExternal />
            </Button>
          </Link>
        </Stack>
      </Box>
    </Box>
  );
};
export default SidebarMobile;
