import {
  Box,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import { Scene } from "@repo/base-plugin";
import { OverlayToggleComponentProps } from "@repo/ui";
import { useState } from "react";
import { typeidUnboxed } from "typeid-js";

import { usePluginMetaData } from "../../../contexts/PluginMetaDataProvider";
import { mainState } from "../../../yjs";

export type SidebarAddSceneModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const SidebarAddSceneModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: SidebarAddSceneModalPropTypes) => {
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);

  const pluginMetaData = usePluginMetaData();

  const addPlugin = () => {
    mainState.data[typeidUnboxed("scene")] = {
      name: "MWL",
      order:
        (Math.max(0, ...Object.values(mainState.data).map((x) => x.order)) ??
          0) + 1,
      type: "scene",
      children: {
        [typeidUnboxed("plugin")]: {
          plugin: selectedPlugin,
          order: 1,
          pluginData: {},
        },
      },
    } as Scene;

    onToggle?.();
    resetData?.();
  };

  return (
    <Modal
      size="xl"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add scene</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Box>
            {pluginMetaData?.pluginMeta.sceneCreator.map((sceneCreator) => (
              <Box
                key={sceneCreator.pluginName}
                bg={
                  selectedPlugin === sceneCreator.pluginName
                    ? "gray.200"
                    : "transparent"
                }
                _hover={{ bg: "gray.100" }}
                cursor="pointer"
                onClick={() => {
                  setSelectedPlugin(sceneCreator.pluginName);
                }}
              >
                {sceneCreator.title}
              </Box>
            ))}
          </Box>
        </ModalBody>

        <ModalFooter>
          <Button
            colorScheme="green"
            mr={3}
            isDisabled={selectedPlugin === null}
            onClick={() => {
              addPlugin();
            }}
          >
            Add Plugin
          </Button>
          <Button variant="ghost" onClick={onToggle}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SidebarAddSceneModal;
