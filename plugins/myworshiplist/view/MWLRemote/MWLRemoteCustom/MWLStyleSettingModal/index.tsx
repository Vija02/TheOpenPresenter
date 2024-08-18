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
import { InputControl, SubmitButton, SwitchControl } from "formik-chakra-ui";
import { useCallback, useEffect, useMemo } from "react";
import { toFormikValidationSchema as toFormicValidationSchema } from "zod-formik-adapter";

import { getSlideStyle } from "../../../../src/slideStyle";
import { SlideStyle, slideStyleValidator } from "../../../../src/types";
import { pluginApi } from "../../../util";

export type MWLStyleSettingModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const MWLStyleSettingModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: MWLStyleSettingModalPropTypes) => {
  const mutablePluginInfo = pluginApi.scene.useValtioData();

  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const style = useMemo(() => pluginData.style, [pluginData.style]);

  const slideStyle = getSlideStyle(style);

  useEffect(() => {
    if (style === undefined) {
      mutablePluginInfo.pluginData.style = {};
    }
  }, [mutablePluginInfo.pluginData, style]);

  const handleSubmit = useCallback(
    (data: SlideStyle) => {
      mutablePluginInfo.pluginData.style = data;
      resetData?.();
      onToggle?.();
      return Promise.resolve();
    },
    [mutablePluginInfo.pluginData, onToggle, resetData],
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
        initialValues={slideStyle}
        validationSchema={toFormicValidationSchema(slideStyleValidator)}
        onSubmit={handleSubmit}
      >
        {({ handleSubmit }) => (
          <Form onSubmit={handleSubmit as any}>
            <ModalContent>
              <ModalHeader>Slide Styles</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <VStack alignItems="flex-start">
                  <SwitchControl name="isDarkMode" label="Is Dark Mode" />
                  <InputControl name="fontWeight" label="Font Weight" />
                  <InputControl
                    name="padding"
                    label="Padding"
                    inputProps={{ type: "number" }}
                  />
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

export default MWLStyleSettingModal;