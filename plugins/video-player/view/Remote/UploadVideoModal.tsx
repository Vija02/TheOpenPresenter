import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { appData } from "@repo/lib";
import { OverlayToggleComponentProps } from "@repo/ui";
import Uppy from "@uppy/core";
import { FileInput, StatusBar, useUppyEvent } from "@uppy/react";
import XHR from "@uppy/xhr-upload";
import { useState } from "react";
import { typeidUnboxed } from "typeid-js";

import { usePluginAPI } from "../pluginApi";

export type UploadVideoModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const UploadVideoModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: UploadVideoModalPropTypes) => {
  const pluginApi = usePluginAPI();
  const [uppy] = useState(() =>
    new Uppy({
      meta: { organizationId: pluginApi.pluginContext.organizationId },
    }).use(XHR, {
      endpoint: pluginApi.media.formDataUploadUrl,
      headers: {
        "csrf-token": appData.getCSRFToken(),
      },
    }),
  );
  const mutableSceneData = pluginApi.scene.useValtioData();

  useUppyEvent(uppy, "upload-success", (_file, response) => {
    const url = (response.body as any)?.url as string;

    mutableSceneData.pluginData.videos.push({
      id: typeidUnboxed("video"),
      metadata: {},
      url: url,
    });
    onToggle?.();
  });

  return (
    <Modal
      size="xl"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Text>Upload Video</Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FileInput uppy={uppy} pretty />
          <StatusBar uppy={uppy} />
        </ModalBody>

        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default UploadVideoModal;
