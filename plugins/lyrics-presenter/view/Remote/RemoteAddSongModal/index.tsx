import {
  Box,
  Button,
  Grid,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { OverlayToggleComponentProps } from "@repo/ui";
import { useCallback, useState } from "react";
import { useDebounce } from "use-debounce";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";

export type RemoteAddSongModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const RemoteAddSongModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: RemoteAddSongModalPropTypes) => {
  const pluginApi = usePluginAPI();
  const pluginInfo = pluginApi.scene.useValtioData();

  const [selected, setSelected] = useState<{ type: string; id: number } | null>(
    null,
  );
  const [searchInput, setSearchInput] = useState("");

  const [debouncedSearchInput] = useDebounce(searchInput, 200);

  const { data: songData } = trpc.lyricsPresenter.search.useQuery({
    title: debouncedSearchInput,
  });
  const { data: playlistData } = trpc.lyricsPresenter.playlist.useQuery();

  const addSong = useCallback(() => {
    if (selected) {
      if (selected.type === "song") {
        pluginInfo.pluginData.songs.push({
          id: selected.id,
          setting: { displayType: "sections" },
        });
      } else if (selected.type === "playlist") {
        const playlist = playlistData?.data.find(
          (x: any) => x.id === selected.id,
        );
        playlist.content.forEach((x: any) => {
          pluginInfo.pluginData.songs.push({
            id: x.id,
            setting: { displayType: "sections" },
          });
        });
      }
      onToggle?.();
      resetData?.();
    }
  }, [
    selected,
    onToggle,
    resetData,
    pluginInfo.pluginData.songs,
    playlistData?.data,
  ]);

  return (
    <Modal
      size="xl"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      scrollBehavior="inside"
      {...props}
    >
      <ModalOverlay />
      <ModalContent maxW="900">
        <ModalHeader>Add song(s)</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Box>
            <Text pb={2} fontSize="lg" fontWeight="600">
              Recent Playlist
            </Text>
            <Grid
              gridTemplateColumns="repeat(auto-fit, minmax(min(200px, 100%), 1fr))"
              gap={1}
            >
              {playlistData?.data.map((playlist: any) => (
                <Box
                  key={playlist.id}
                  p={1}
                  cursor="pointer"
                  _hover={{ bg: "gray.100" }}
                  flex={1}
                  whiteSpace="nowrap"
                  border="1px solid"
                  borderColor="gray.300"
                  bg={
                    selected?.type === "playlist" &&
                    selected?.id === playlist.id
                      ? "gray.200"
                      : "transparent"
                  }
                  onClick={() => {
                    setSelected({ type: "playlist", id: playlist.id });
                  }}
                >
                  <Text fontWeight="bold" fontSize="md">
                    {playlist?.title}
                  </Text>
                  <Box color="gray.800">
                    {playlist.content.map((content: any) => (
                      <Text
                        key={content.id}
                        textOverflow="ellipsis"
                        overflow="hidden"
                      >
                        - {content.title}
                      </Text>
                    ))}
                  </Box>
                </Box>
              ))}
            </Grid>
          </Box>
          <Text pb={1} pt={4} fontSize="lg" fontWeight="600">
            Songs
          </Text>
          <Input
            mb={2}
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Box>
            {songData?.data.map((x: any) => (
              <Box
                key={x.id}
                bg={
                  selected?.type === "song" && selected?.id === x.id
                    ? "gray.200"
                    : "transparent"
                }
                _hover={{ bg: "gray.100" }}
                cursor="pointer"
                onClick={() => {
                  setSelected({ type: "song", id: x.id });
                }}
                py={1}
                px={1}
              >
                <Text fontSize="md" lineHeight={1}>
                  {x.title}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {x.author}
                </Text>
              </Box>
            ))}
          </Box>
        </ModalBody>

        <ModalFooter>
          <Button
            colorScheme="green"
            mr={3}
            isDisabled={selected === null}
            onClick={() => {
              addSong();
            }}
          >
            Add to list
          </Button>
          <Button variant="ghost" onClick={onToggle}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default RemoteAddSongModal;
