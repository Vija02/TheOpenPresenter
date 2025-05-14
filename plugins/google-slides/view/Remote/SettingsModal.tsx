import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
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
  VStack,
  chakra,
} from "@chakra-ui/react";
import { OverlayToggleComponentProps } from "@repo/ui";
import { Form, Formik } from "formik";
import { SubmitButton } from "formik-chakra-ui";
import { useCallback } from "react";
import { FaCircleInfo as FaCircleInfoRaw } from "react-icons/fa6";

import { DisplayMode } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { displayTypeMapping } from "./displayTypeMapping";

const FaCircleInfo = chakra(FaCircleInfoRaw);

export type SettingsModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

type SettingsData = {
  displayMode?: DisplayMode;
};

const SettingsModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: SettingsModalPropTypes) => {
  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const type = pluginApi.scene.useData((x) => x.pluginData.type);
  const displayMode = pluginApi.renderer.useData((x) => x.displayMode);

  const handleSubmit = useCallback(
    (rawData: SettingsData) => {
      mutableRendererData.displayMode = rawData.displayMode;

      // If changing to image
      if (
        mutableRendererData.displayMode === "googleslides" &&
        rawData.displayMode === "image"
      ) {
        mutableRendererData.slideIndex = mutableRendererData.resolvedSlideIndex;
      }
      // Handle the reverse
      if (
        mutableRendererData.displayMode === "image" &&
        rawData.displayMode === "googleslides"
      ) {
        mutableRendererData.resolvedSlideIndex =
          (mutableRendererData.slideIndex ?? 0) +
          (mutableRendererData.clickCount ?? 0);
        mutableRendererData.slideIndex =
          (mutableRendererData.slideIndex ?? 0) +
          (mutableRendererData.clickCount ?? 0);

        mutableRendererData.clickCount = 0;
      }

      resetData?.();
      onToggle?.();
      return Promise.resolve();
    },
    [mutableRendererData, onToggle, resetData],
  );

  return (
    <Modal
      size={{ base: "full", md: "3xl" }}
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      scrollBehavior="inside"
      {...props}
    >
      <ModalOverlay />
      <Formik
        initialValues={
          { displayMode: displayMode ?? "googleslides" } as SettingsData
        }
        onSubmit={handleSubmit}
      >
        {({ handleSubmit, values, setFieldValue }) => {
          return (
            <Form onSubmit={handleSubmit as any}>
              <ModalContent>
                <ModalHeader px={{ base: 3, md: 6 }}>
                  Slides Settings
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody px={{ base: 3, md: 6 }}>
                  <Flex flexDir={{ base: "column", md: "row" }} gap={3}>
                    <VStack flex={1} alignItems="flex-start">
                      <FormControl>
                        <FormLabel>Display Mode</FormLabel>
                        <Stack
                          direction={{ base: "column", md: "row" }}
                          alignItems="stretch"
                          marginBottom={2}
                          flexWrap="wrap"
                        >
                          {[
                            {
                              title: "Google Slides",
                              description: (
                                <>
                                  Uses the Google Slides embed renderer <br />
                                  <Box
                                    mt={2}
                                    display="flex"
                                    gap={1}
                                    fontStyle="italic"
                                  >
                                    <FaCircleInfo margin={1} flexShrink={0} />
                                    Preserves the most functionality but takes
                                    the longest to load
                                  </Box>
                                </>
                              ),
                              val: "googleslides" satisfies DisplayMode,
                            },
                            {
                              title: "Image",
                              description: (
                                <>
                                  Renders the presentation as images <br />
                                  <Box
                                    mt={2}
                                    display="flex"
                                    gap={1}
                                    fontStyle="italic"
                                  >
                                    <FaCircleInfo margin={1} flexShrink={0} />
                                    Doesn't allow animations but is faster to
                                    load
                                  </Box>
                                </>
                              ),
                              val: "image" satisfies DisplayMode,
                            },
                          ]
                            .filter((x) =>
                              displayTypeMapping[x.val as DisplayMode].includes(
                                type ?? "googleslides",
                              ),
                            )
                            .map(({ title, description, val }, i) => (
                              <Box
                                key={i}
                                cursor="pointer"
                                border="1px solid"
                                borderColor={
                                  values.displayMode === val
                                    ? "blue.400"
                                    : "gray.200"
                                }
                                rounded="sm"
                                p={2}
                                _hover={{ borderColor: "blue.400" }}
                                onClick={() => {
                                  setFieldValue("displayMode", val);
                                }}
                                width="100%"
                                flex={1}
                              >
                                <Text fontWeight="bold" fontSize="md">
                                  {title}
                                </Text>
                                <Text fontSize="sm" color="gray.600">
                                  {description}
                                </Text>
                              </Box>
                            ))}
                        </Stack>
                      </FormControl>
                    </VStack>
                  </Flex>
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
                      <SubmitButton colorScheme="green">Save</SubmitButton>
                      <Button variant="ghost" onClick={onToggle}>
                        Close
                      </Button>
                    </Stack>
                  </Flex>
                </ModalFooter>
              </ModalContent>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
};

export default SettingsModal;
