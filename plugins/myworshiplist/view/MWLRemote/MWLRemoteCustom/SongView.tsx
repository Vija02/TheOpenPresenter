import { Box, Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { OverlayToggle, PopConfirm, Slide } from "@repo/ui";
import React, { useCallback, useMemo } from "react";
import { VscEdit, VscTrash } from "react-icons/vsc";

import { getSlideStyle } from "../../../src/slideStyle";
import { CustomTypeData } from "../../../src/types";
import MWLSongRenderView from "../../MWLRenderer/MWLSongRenderView";
import { usePluginAPI } from "../../pluginApi";
import {
  cleanWhiteSpace,
  groupData,
  removeAuxiliaryText,
  removeChords,
} from "../../songHelpers";
import MWLRemoteSongEditModal from "./MWLRemoteSongEditModal";

const MWLSongView = React.memo(({ songId }: { songId: number }) => {
  const pluginApi = usePluginAPI();
  const songCaches = pluginApi.scene.useData(
    (x) => (x.pluginData as CustomTypeData).songCache,
  );
  const songCache = useMemo(
    () => songCaches.find((x) => x.id === songId),
    [songCaches, songId],
  );

  if (!songCache) {
    return <Text>Loading...</Text>;
  }
  return <MWLSongViewInner songId={songId} />;
});

const MWLSongViewInner = React.memo(({ songId }: { songId: number }) => {
  const pluginApi = usePluginAPI();
  const songCaches = pluginApi.scene.useData(
    (x) => (x.pluginData as CustomTypeData).songCache,
  );
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style);
  const renderData = pluginApi.renderer.useData((x) => x);

  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const setRenderCurrentScene = pluginApi.renderer.setRenderCurrentScene;

  const songCache = useMemo(
    () => songCaches.find((x) => x.id === songId)!,
    [songCaches, songId],
  );

  const cleanData = useMemo(
    () =>
      removeAuxiliaryText(
        cleanWhiteSpace(removeChords(songCache.content.split("<br>"))),
      ),
    [songCache.content],
  );

  const groupedData = useMemo(() => groupData(cleanData), [cleanData]);

  const handleRemove = useCallback(() => {
    const pluginData = mutableSceneData.pluginData as CustomTypeData;

    pluginData.songIds = pluginData.songIds.filter((x) => x !== songId);
    pluginData.songCache = pluginData.songCache.filter((x) => x.id !== songId);
  }, [mutableSceneData.pluginData, songId]);

  return (
    <Box py={3}>
      <Flex direction="row" alignItems="center" gap={2} mb={2}>
        <Heading fontSize="xl">{songCache.title}</Heading>
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
            <MWLRemoteSongEditModal />
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
        {Object.keys(groupedData).map((section, i) => (
          <Slide
            key={i}
            heading={section}
            isActive={
              section === renderData.heading && songId === renderData.songId
            }
            onClick={() => {
              mutableRendererData.heading = section;
              mutableRendererData.songId = songId;
              setRenderCurrentScene();
            }}
          >
            <MWLSongRenderView
              groupedData={groupedData}
              heading={section}
              slideStyle={getSlideStyle(slideStyle)}
            />
          </Slide>
        ))}
      </Flex>
    </Box>
  );
});

export default MWLSongView;
