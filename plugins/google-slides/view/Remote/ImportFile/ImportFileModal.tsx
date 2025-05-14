import {
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Stack,
} from "@chakra-ui/react";
import { OverlayToggleComponentProps } from "@repo/ui";

import { ImportFilePicker } from "./ImportFilePicker";

export type ImportFileModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const ImportFileModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: ImportFileModalPropTypes) => {
  return (
    <Modal
      size={{ base: "full", md: "3xl" }}
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      scrollBehavior="inside"
      {...props}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader px={{ base: 3, md: 6 }}>Replace slide</ModalHeader>
        <ModalCloseButton />
        <ModalBody px={{ base: 3, md: 6 }}>
          <ImportFilePicker />
        </ModalBody>

        <ModalFooter
          pt={0}
          px={0}
          boxShadow={{
            base: "rgba(0, 0, 0, 0.8) 0px 5px 10px 0px",
            md: "none",
          }}
        >
          <Flex flexDir="column" width="100%">
            <Stack
              px={{ base: 3, md: 6 }}
              pt={3}
              direction="row"
              alignSelf="flex-end"
            >
              <Button variant="ghost" onClick={onToggle}>
                Close
              </Button>
            </Stack>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ImportFileModal;
