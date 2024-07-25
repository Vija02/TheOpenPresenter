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

import { trpc } from "../../../trpc";
import { useValtioSceneData } from "../../../util";

export type MWLRemoteCustomAddSongModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const MWLRemoteCustomAddSongModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: MWLRemoteCustomAddSongModalPropTypes) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const pluginInfo = useValtioSceneData();

  const { data } = trpc.myworshiplist.search.useQuery({ title: "hi" });

  const addSong = useCallback(() => {
    if (selectedId) {
      pluginInfo.pluginData.songIds.push(selectedId);
      onToggle?.();
      resetData?.();
    }
  }, [pluginInfo.pluginData.songIds, onToggle, resetData, selectedId]);

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
          <Input placeholder="Search..." />
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

export default MWLRemoteCustomAddSongModal;
