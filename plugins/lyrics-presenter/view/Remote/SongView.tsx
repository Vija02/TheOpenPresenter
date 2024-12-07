import { Box, Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { OverlayToggle, PopConfirm, SlideGrid } from "@repo/ui";
import React, { useCallback } from "react";
import { VscEdit, VscTrash } from "react-icons/vsc";

import { Song } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import RemoteEditSongModal from "./RemoteEditSongModal";
import { SongViewSlides } from "./SongViewSlides";

const SongView = React.memo(({ song }: { song: Song }) => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();

  const handleRemove = useCallback(() => {
    const pluginData = mutableSceneData.pluginData;

    pluginData.songs = pluginData.songs.filter((s) => s.id !== song.id);
  }, [mutableSceneData.pluginData, song.id]);

  if (!song._imported && !!song.import) {
    return (
      <Stack direction="column" bg="gray.100" p={2} mb={2} spacing={0}>
        <Text fontWeight="bold">{song.title}</Text>
        <Stack direction="row" alignItems="center">
          <Text>Importing data from {song.import.type}...</Text>
          <Button
            size="sm"
            variant="ghost"
            rounded="none"
            onClick={handleRemove}
          >
            <VscTrash />
          </Button>
        </Stack>
      </Stack>
    );
  }
  return <SongViewInner song={song} />;
});

const SongViewInner = React.memo(({ song }: { song: Song }) => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style) ?? {};

  const handleRemove = useCallback(() => {
    const pluginData = mutableSceneData.pluginData;

    pluginData.songs = pluginData.songs.filter((s) => s.id !== song.id);
  }, [mutableSceneData.pluginData, song.id]);

  return (
    <Box pb={4}>
      <Flex
        direction={{ base: "column", sm: "row" }}
        alignItems={{ base: "flex-start", sm: "center" }}
        gap={2}
        mb={2}
      >
        <Heading fontSize="xl" mb={0} fontWeight="bold">
          {song.title}
        </Heading>
        <Stack direction="row" gap={0}>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                size="sm"
                variant="ghost"
                rounded="none"
                onClick={onToggle}
              >
                <VscEdit />
              </Button>
            )}
          >
            <RemoteEditSongModal song={song} />
          </OverlayToggle>
          <PopConfirm
            title={`Are you sure you want to remove this song?`}
            onConfirm={handleRemove}
            okText="Yes"
            cancelText="No"
            key="remove"
          >
            <Button size="sm" variant="ghost" rounded="none">
              <VscTrash />
            </Button>
          </PopConfirm>
        </Stack>
      </Flex>
      <SlideGrid>
        <SongViewSlides song={song} slideStyle={slideStyle} />
      </SlideGrid>
    </Box>
  );
});

export default SongView;
