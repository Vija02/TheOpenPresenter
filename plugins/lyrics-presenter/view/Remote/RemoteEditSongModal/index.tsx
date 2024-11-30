import {
  Box,
  Button,
  Flex,
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
  Show,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { MotionBox, OverlayToggleComponentProps } from "@repo/ui";
import { Form, Formik } from "formik";
import { InputControl, SelectControl, SubmitButton } from "formik-chakra-ui";
import { useCallback, useMemo, useState } from "react";
import { FaChevronUp } from "react-icons/fa";
import { toFormikValidationSchema } from "zod-formik-adapter";

import { removeChords } from "../../../src/processLyrics";
import {
  Song,
  SongSetting,
  displayTypeSettings,
  songSettingValidator,
} from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { SongViewSlides } from "../SongViewSlides";
import { LyricFormLabel } from "./LyricFormLabel";
import SongEditEditor from "./SongEditEditor";

export type RemoteEditSongModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & { song: Song };

const RemoteEditSongModal = ({
  song,
  isOpen,
  onToggle,
  resetData,
  ...props
}: RemoteEditSongModalPropTypes) => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  const [previewOpen, setPreviewOpen] = useState(false);

  const handleSubmit = useCallback(
    ({
      title,
      content,
      ...data
    }: SongSetting & Pick<Song, "title" | "content">) => {
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
      mutableSceneData.pluginData.songs[index]!.title = title;
      mutableSceneData.pluginData.songs[index]!.content = content;

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
    () => (song.import?.importedData?.content ?? "").split("<br>").join("\n"),
    [song.import?.importedData?.content],
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
          title: song.title,
          content: song.content,
        }}
        validationSchema={toFormikValidationSchema(songSettingValidator)}
        onSubmit={handleSubmit}
      >
        {({ handleSubmit, values, setFieldValue }) => {
          const preview = (
            <SongViewSlides
              song={{
                ...song,
                setting: values,
                content: values.content,
              }}
              isPreview
            />
          );

          return (
            <Form onSubmit={handleSubmit as any}>
              <ModalContent>
                <ModalHeader px={{ base: 3, md: 6 }}>
                  Edit song "{song.title}"
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody px={{ base: 3, md: 6 }}>
                  <Flex flexDir={{ base: "column", md: "row" }} gap={3}>
                    <VStack flex={1} alignItems="flex-start">
                      <InputControl name="title" label="Title" />
                      <SelectControl name="displayType" label="Display Type">
                        {Object.entries(displayTypeSettings).map(
                          ([key, { label }]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ),
                        )}
                      </SelectControl>

                      <LyricFormLabel
                        onRemoveChords={() => {
                          setFieldValue(
                            "content",
                            removeChords(values.content.split("\n")).join("\n"),
                          );
                        }}
                        canReset={values.content !== originalContent}
                        onReset={() => {
                          setFieldValue("content", originalContent);
                        }}
                      />
                      <SongEditEditor
                        initialContent={values.content
                          .split("\n")
                          .map((x) => `<p>${x}</p>`)
                          .join("")}
                        onChange={(val) => {
                          setFieldValue("content", val);
                        }}
                      />
                    </VStack>
                    <Show above="md">
                      <VStack flexBasis="200px">
                        <Heading fontSize="lg">Preview</Heading>
                        {preview}
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
                            {preview}
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
          );
        }}
      </Formik>
    </Modal>
  );
};

export default RemoteEditSongModal;
