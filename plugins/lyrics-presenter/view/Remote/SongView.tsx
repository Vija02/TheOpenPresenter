import { Box, Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { OverlayToggle, PopConfirm } from "@repo/ui";
import React, { useCallback } from "react";
import { VscEdit, VscTrash } from "react-icons/vsc";

import { Song } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import RemoteEditSongModal from "./RemoteEditSongModal";
import { SongViewSlides } from "./SongViewSlides";

const SongView = React.memo(({ song }: { song: Song }) => {
  if (!song._imported && !!song.import) {
    return <Text>Importing...</Text>;
  }
  return <SongViewInner song={song} />;
});

const SongViewInner = React.memo(({ song }: { song: Song }) => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();

  const handleRemove = useCallback(() => {
    const pluginData = mutableSceneData.pluginData;

    pluginData.songs = pluginData.songs.filter((s) => s.id !== song.id);
  }, [mutableSceneData.pluginData, song.id]);

  return (
    <Box pb={4}>
      <Flex direction="row" alignItems="center" gap={2} mb={2}>
        <Heading fontSize="xl">{song.title}</Heading>
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
      <Flex gap={3} flexWrap="wrap">
        <SongViewSlides song={song} />
      </Flex>
    </Box>
  );
});

export default SongView;
