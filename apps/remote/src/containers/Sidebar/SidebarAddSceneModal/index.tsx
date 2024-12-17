import {
  Badge,
  Box,
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
  Text,
  chakra,
} from "@chakra-ui/react";
import { Scene, SceneCategories, sceneCategories } from "@repo/base-plugin";
import { RemoteBasePluginQuery } from "@repo/graphql";
import { usePluginData, usePluginMetaData } from "@repo/shared";
import { OverlayToggleComponentProps } from "@repo/ui";
import React, { useState } from "react";
import { FaStar as FaStarRaw } from "react-icons/fa";
import { IconType } from "react-icons/lib";
import { MdOutlineOndemandVideo } from "react-icons/md";
import { PiMusicNotesSimple, PiPresentationChart } from "react-icons/pi";
import { typeidUnboxed } from "typeid-js";
import { useLocation } from "wouter";

const FaStar = chakra(FaStarRaw);

export type SidebarAddSceneModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const sceneCategoriesConfig: Record<SceneCategories, IconType> = {
  Display: PiPresentationChart,
  Media: MdOutlineOndemandVideo,
  Audio: PiMusicNotesSimple,
};

const SidebarAddSceneModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: SidebarAddSceneModalPropTypes) => {
  const [, navigate] = useLocation();

  const [selectedCategory, setSelectedCategory] = useState("All");

  const mainState = usePluginData().mainState!;
  const pluginMetaData = usePluginMetaData()
    .pluginMetaData as RemoteBasePluginQuery;

  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const selectedSceneCreator = pluginMetaData?.pluginMeta.sceneCreator.find(
    (x) => x.pluginName === selectedPlugin,
  );

  const addPlugin = () => {
    const sceneId = typeidUnboxed("scene");
    mainState.data[sceneId] = {
      name: selectedSceneCreator?.title,
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

    navigate(`/${sceneId}`);

    onToggle?.();
    resetData?.();
  };

  return (
    <Modal
      size={{ base: "full", md: "xl" }}
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add scene</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text fontWeight="bold" mb={2}>
            Select a component to add:
          </Text>
          <Flex>
            <Stack
              display={{ base: "none", sm: "flex" }}
              pr={4}
              borderRight="1px solid rgb(0, 0, 0, 0.1)"
              spacing={0}
            >
              <Text fontWeight="bold" mb={2}>
                Categories
              </Text>
              {["All"].concat(sceneCategories).map((category) => (
                <Box
                  key={category}
                  bg={category === selectedCategory ? "blue.50" : ""}
                  px={2}
                  py={1}
                  cursor="pointer"
                  _hover={{ bg: "blue.50" }}
                  onClick={() => {
                    setSelectedCategory(category);
                  }}
                >
                  <Text>{category}</Text>
                </Box>
              ))}
            </Stack>
            <Stack pl={{ base: "", sm: "4" }} width="100%">
              {sceneCategories
                .filter(
                  (x) => selectedCategory === "All" || selectedCategory === x,
                )
                .map((category) => (
                  <Box key={category}>
                    <Stack direction="row" alignItems="center">
                      {React.createElement(sceneCategoriesConfig[category], {
                        fontSize: 20,
                      })}
                      <Text fontWeight="bold" fontSize="xl" mb={1}>
                        {category}
                      </Text>
                    </Stack>
                    <Stack spacing={1}>
                      {pluginMetaData?.pluginMeta.sceneCreator
                        .filter((x) => x.categories.includes(category))
                        .map((sceneCreator) => (
                          <Box
                            key={sceneCreator.pluginName}
                            bg={
                              selectedPlugin === sceneCreator.pluginName
                                ? "gray.200"
                                : "transparent"
                            }
                            cursor="pointer"
                            border="1px solid"
                            borderColor="gray.200"
                            p={2}
                            _hover={{ borderColor: "blue.400" }}
                            onClick={() => {
                              setSelectedPlugin(sceneCreator.pluginName);
                            }}
                          >
                            <Stack direction="row" alignItems="center">
                              <Text fontWeight="bold">
                                {sceneCreator.title}
                              </Text>
                              {sceneCreator.isExperimental && (
                                <Badge variant="subtle" colorScheme="red">
                                  Experimental
                                </Badge>
                              )}
                              {sceneCreator.isStarred && (
                                <FaStar color="yellow.400" />
                              )}
                            </Stack>
                            <Text>{sceneCreator.description}</Text>
                          </Box>
                        ))}
                    </Stack>
                  </Box>
                ))}
            </Stack>
          </Flex>
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
            Add Scene
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
