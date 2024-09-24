import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import { OverlayToggleComponentProps } from "@repo/ui";

import { usePluginAPI } from "../../../pluginApi";

export type MWLRemoteSongEditModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const MWLRemoteSongEditModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: MWLRemoteSongEditModalPropTypes) => {
  const pluginApi = usePluginAPI();

  return (
    <Modal
      size="xl"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Song Edit</ModalHeader>
        <ModalCloseButton />
        <ModalBody></ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default MWLRemoteSongEditModal;
