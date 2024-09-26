import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  VStack,
} from "@chakra-ui/react";
import { OverlayToggleComponentProps } from "@repo/ui";
import { Form, Formik } from "formik";
import { SelectControl, SubmitButton } from "formik-chakra-ui";
import { useCallback } from "react";
import { toFormikValidationSchema } from "zod-formik-adapter";

import {
  Song,
  SongSetting,
  displayTypeSettings,
  slideStyleValidator,
} from "../../../src";
import { usePluginAPI } from "../../pluginApi";

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

  const handleSubmit = useCallback(
    (data: SongSetting) => {
      const index = mutableSceneData.pluginData.songs.findIndex(
        (x) => x.id === song.id,
      );
      mutableSceneData.pluginData.songs[index]!.setting = data;
      resetData?.();
      onToggle?.();
      return Promise.resolve();
    },
    [mutableSceneData.pluginData.songs, onToggle, resetData, song.id],
  );

  return (
    <Modal
      size="xl"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <Formik
        initialValues={song.setting}
        validationSchema={toFormikValidationSchema(slideStyleValidator)}
        onSubmit={handleSubmit}
      >
        {({ handleSubmit }) => (
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
