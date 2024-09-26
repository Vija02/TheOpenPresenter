import {
  Box,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import { OverlayToggleComponentProps } from "@repo/ui";
import { useCallback, useState } from "react";
import { useDebounce } from "use-debounce";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";

export type MWLRemoteAddSongModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const MWLRemoteAddSongModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: MWLRemoteAddSongModalPropTypes) => {
  const pluginApi = usePluginAPI();
  const pluginInfo = pluginApi.scene.useValtioData();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const [debouncedSearchInput] = useDebounce(searchInput, 200);

  const { data } = trpc.myworshiplist.search.useQuery({
    title: debouncedSearchInput,
  });

  const addSong = useCallback(() => {
    if (selectedId) {
      pluginInfo.pluginData.songs.push({
        id: selectedId,
        setting: { displayType: "sections" },
      });
      onToggle?.();
      resetData?.();
    }
  }, [selectedId, pluginInfo.pluginData.songs, onToggle, resetData]);

  return (
    <Modal
      size="xl"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add song</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Input
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Box>
            {data?.data.map((x: any) => (
              <Box
                key={x.id}
                bg={selectedId === x.id ? "gray.200" : "transparent"}
                _hover={{ bg: "gray.100" }}
                cursor="pointer"
                onClick={() => {
                  setSelectedId(x.id);
                }}
              >
                {x.title}
              </Box>
            ))}
          </Box>
        </ModalBody>

        <ModalFooter>
          <Button
            colorScheme="green"
            mr={3}
            isDisabled={selectedId === null}
            onClick={() => {
              addSong();
            }}
          >
            Add song
          </Button>
          <Button variant="ghost" onClick={onToggle}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default MWLRemoteAddSongModal;
