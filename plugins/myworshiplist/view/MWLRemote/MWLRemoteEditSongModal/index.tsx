import {
  Box,
  Button,
  Flex,
  FormLabel,
  Grid,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Popover,
  PopoverTrigger,
  Show,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { MotionBox, OverlayToggleComponentProps } from "@repo/ui";
import { Form, Formik } from "formik";
import { SelectControl, SubmitButton } from "formik-chakra-ui";
import { useCallback, useMemo, useState } from "react";
import { FaChevronUp } from "react-icons/fa";
import { FaCircleInfo } from "react-icons/fa6";
import { toFormikValidationSchema } from "zod-formik-adapter";

import {
  Song,
  SongSetting,
  displayTypeSettings,
  slideStyleValidator,
} from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { removeChords } from "../../songHelpers";
import { SongViewSlides } from "../SongViewSlides";
import SongEditEditor from "./SongEditEditor";
import { SongEditInfo } from "./SongEditInfo";

export type MWLRemoteEditSongModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & { song: Song };

const MWLRemoteEditSongModal = ({
  song,
  isOpen,
  onToggle,
  resetData,
  ...props
}: MWLRemoteEditSongModalPropTypes) => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  const [previewOpen, setPreviewOpen] = useState(false);

  const handleSubmit = useCallback(
    ({
      modifiedContent,
      ...data
    }: SongSetting & { modifiedContent: string }) => {
      const index = mutableSceneData.pluginData.songs.findIndex(
        (x) => x.id === song.id,
      );

      // If we're changing this song to sections and the current song is selected,
      // Then we want to reset the index to the first item
      if (
        data.displayType === "sections" &&
        mutableSceneData.pluginData.songs[index]!.setting.displayType !==
          "sections" &&
        mutableRendererData.songId === song.id
      ) {
        mutableRendererData.currentIndex = 0;
      }

      mutableSceneData.pluginData.songs[index]!.setting = data;
      mutableSceneData.pluginData.songs[index]!.modifiedContent =
        modifiedContent;

      resetData?.();
      onToggle?.();
      return Promise.resolve();
    },
    [
      mutableRendererData,
      mutableSceneData.pluginData.songs,
      onToggle,
      resetData,
      song,
    ],
  );

  const originalContent = useMemo(
    () => (song.cachedData?.content ?? "").split("<br>").join("\n"),
    [song.cachedData?.content],
  );
  const modifiedContent = useMemo(
    () =>
      song.modifiedContent
        ? song.modifiedContent.split("<br>").join("\n")
        : undefined,
    [song.modifiedContent],
  );
  const content = useMemo(
    () => modifiedContent ?? originalContent,
    [modifiedContent, originalContent],
  );

  return (
    <Modal
      size={{ base: "full", md: "5xl" }}
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      scrollBehavior="inside"
      {...props}
    >
      <ModalOverlay />
      <Formik
        initialValues={{
          ...song.setting,
          modifiedContent: content,
        }}
        validationSchema={toFormikValidationSchema(slideStyleValidator)}
        onSubmit={handleSubmit}
      >
        {({ handleSubmit, values, setFieldValue }) => (
          <Form onSubmit={handleSubmit as any}>
            <ModalContent>
              <ModalHeader px={{ base: 3, md: 6 }}>
                Edit song "{song.cachedData?.title}"
              </ModalHeader>
              <ModalCloseButton />
              <ModalBody px={{ base: 3, md: 6 }}>
                <Flex flexDir={{ base: "column", md: "row" }} gap={3}>
                  <VStack flex={1} alignItems="flex-start">
                    <SelectControl name="displayType" label="Display Type">
                      {Object.entries(displayTypeSettings).map(
                        ([key, { label }]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ),
                      )}
                    </SelectControl>

                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      width="100%"
                    >
                      <FormLabel mb={0}>
                        Content{" "}
                        <Popover>
                          <PopoverTrigger>
                            <Button size="sm" variant="ghost">
                              <FaCircleInfo color="gray" />
                            </Button>
                          </PopoverTrigger>
                          <SongEditInfo />
                        </Popover>
                      </FormLabel>
                      <Stack direction="row" alignItems="center">
                        <Button
                          size="xs"
                          onClick={() => {
                            setFieldValue(
                              "modifiedContent",
                              removeChords(
                                values.modifiedContent.split("\n"),
                              ).join("\n"),
                            );
                          }}
                        >
                          Remove chords
                        </Button>
                        {values.modifiedContent !== originalContent && (
                          <Button
                            size="xs"
                            onClick={() => {
                              setFieldValue("modifiedContent", originalContent);
                            }}
                          >
                            Reset
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                    <SongEditEditor
                      initialContent={values.modifiedContent
                        .split("\n")
                        .map((x) => `<p>${x}</p>`)
                        .join("")}
                      onChange={(val) => {
                        setFieldValue("modifiedContent", val);
                      }}
                    />
                  </VStack>
                  <Show above="md">
                    <VStack flexBasis="200px">
                      <Heading fontSize="lg">Preview</Heading>
                      <SongViewSlides
                        song={{
                          ...song,
                          setting: values,
                          modifiedContent: values.modifiedContent,
                        }}
                        isPreview
                      />
                    </VStack>
                  </Show>
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
                  <Box borderBottom="1px solid rgb(0,0,0,0.1)">
                    <Button
                      display={{ base: "flex", md: "none" }}
                      gap={2}
                      variant="ghost"
                      borderRadius={0}
                      onClick={() => setPreviewOpen((prev) => !prev)}
                      width="100%"
                    >
                      <Text>Preview </Text>{" "}
                      <FaChevronUp
                        style={{
                          transform: previewOpen ? "rotate(180deg)" : "",
                        }}
                        fontSize={14}
                      />
                    </Button>
                    <Show below="md">
                      <MotionBox
                        initial="close"
                        variants={{
                          open: { height: "30vh" },
                          close: { height: "0vh" },
                        }}
                        animate={previewOpen ? "open" : "close"}
                        overflow="hidden"
                      >
                        <Grid
                          maxHeight="30vh"
                          overflow="auto"
                          px={3}
                          gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))"
                        >
                          <SongViewSlides
                            song={{
                              ...song,
                              setting: values,
                              modifiedContent: values.modifiedContent,
                            }}
                            isPreview
                          />
                        </Grid>
                      </MotionBox>
                    </Show>
                  </Box>
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
        )}
      </Formik>
    </Modal>
  );
};

export default MWLRemoteEditSongModal;
