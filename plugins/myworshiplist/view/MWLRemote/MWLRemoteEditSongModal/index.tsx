import {
  Button,
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
  VStack,
} from "@chakra-ui/react";
import { OverlayToggleComponentProps } from "@repo/ui";
import { Form, Formik } from "formik";
import { SelectControl, SubmitButton } from "formik-chakra-ui";
import { useCallback, useMemo } from "react";
import { toFormikValidationSchema } from "zod-formik-adapter";

import {
  Song,
  SongSetting,
  displayTypeSettings,
  slideStyleValidator,
} from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { processSongCache } from "../../songHelpers";
import TextareaControl from "./TextareaControl";

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

  const handleSubmit = useCallback(
    ({
      modifiedContent,
      ...data
    }: SongSetting & { modifiedContent: string }) => {
      const index = mutableSceneData.pluginData.songs.findIndex(
        (x) => x.id === song.id,
      );

      // If we're changing this song to sections and the current song is selected,
      // Then we want to reset the heading to the first item
      if (
        data.displayType === "sections" &&
        mutableSceneData.pluginData.songs[index]!.setting.displayType !==
          "sections" &&
        mutableRendererData.songId === song.id
      ) {
        mutableRendererData.heading =
          Object.keys(processSongCache(song))[0] ?? "";
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
      size="xl"
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
              <ModalHeader>Edit song "{song.cachedData?.title}"</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <VStack alignItems="flex-start">
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
                    <FormLabel mb={0}>Content</FormLabel>
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
                  <TextareaControl name="modifiedContent" />
                </VStack>
              </ModalBody>
              <ModalFooter>
                <SubmitButton colorScheme="green">Save</SubmitButton>
                <Button variant="ghost" onClick={onToggle}>
                  Close
                </Button>
              </ModalFooter>
            </ModalContent>
          </Form>
        )}
      </Formik>
    </Modal>
  );
};

export default MWLRemoteEditSongModal;
