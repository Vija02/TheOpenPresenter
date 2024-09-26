import { Box, Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { OverlayToggle, PopConfirm } from "@repo/ui";
import React, { useCallback } from "react";
import { VscEdit, VscTrash } from "react-icons/vsc";

import { Song } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import MWLRemoteEditSongModal from "./MWLRemoteEditSongModal";
import { SongViewSlides } from "./SongViewSlides";

const MWLSongView = React.memo(({ song }: { song: Song }) => {
  if (!song.cachedData) {
    return <Text>Loading...</Text>;
  }
  return <MWLSongViewInner song={song} />;
});

const MWLSongViewInner = React.memo(({ song }: { song: Song }) => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();

  const handleRemove = useCallback(() => {
    const pluginData = mutableSceneData.pluginData;

    pluginData.songs = pluginData.songs.filter((s) => s.id !== song.id);
  }, [mutableSceneData.pluginData, song.id]);

  return (
    <Box py={3}>
      <Flex direction="row" alignItems="center" gap={2} mb={2}>
        <Heading fontSize="xl">{song.cachedData?.title}</Heading>
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
            <MWLRemoteEditSongModal song={song} />
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

export default MWLSongView;
