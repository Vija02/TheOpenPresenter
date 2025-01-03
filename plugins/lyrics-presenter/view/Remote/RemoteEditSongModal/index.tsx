import {
  Button,
  Flex,
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
  VStack,
} from "@chakra-ui/react";
import { OverlayToggleComponentProps, SlideGrid } from "@repo/ui";
import { Form, Formik } from "formik";
import { InputControl, SelectControl, SubmitButton } from "formik-chakra-ui";
import { useCallback, useMemo } from "react";
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
import { MobilePreview } from "./MobilePreview";
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
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style) ?? {};
  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();

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
              slideStyle={slideStyle}
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
                        <SlideGrid forceWidth={200}>{preview}</SlideGrid>
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
                    <MobilePreview preview={preview} />
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
