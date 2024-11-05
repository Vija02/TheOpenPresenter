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
import { InputControl, SubmitButton } from "formik-chakra-ui";
import { useCallback } from "react";

import { useData, usePluginData } from "../contexts/PluginDataProvider";

export type SceneSettingsModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & { selectedScene: string };

const SceneSettingsModal = ({
  isOpen,
  onToggle,
  resetData,
  selectedScene,
  ...props
}: SceneSettingsModalPropTypes) => {
  const data = useData();
  const mainState = usePluginData().mainState!;

  const handleSubmit = useCallback(
    ({ name }: { name: string }) => {
      mainState.data[selectedScene]!.name = name;

      resetData?.();
      onToggle?.();
      return Promise.resolve();
    },
    [mainState.data, onToggle, resetData, selectedScene],
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
        initialValues={{
          name: data.data[selectedScene]?.name ?? "",
        }}
        onSubmit={handleSubmit}
      >
        {({ handleSubmit }) => (
          <Form onSubmit={handleSubmit as any}>
            <ModalContent>
              <ModalHeader>Scene Settings</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <VStack alignItems="flex-start">
                  <InputControl label="Name" name="name" />
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

export default SceneSettingsModal;
