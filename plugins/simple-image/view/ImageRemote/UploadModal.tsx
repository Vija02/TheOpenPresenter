import { Button, Text, useDisclosure } from "@chakra-ui/react";
import {
  SUPPORTED_IMAGE_EXTENSIONS,
  appData,
  extractMediaName,
} from "@repo/lib";
import Uppy from "@uppy/core";
import { DashboardModal, useUppyEvent } from "@uppy/react";
import Tus from "@uppy/tus";
import { useState } from "react";
import { VscAdd } from "react-icons/vsc";

import { usePluginAPI } from "../pluginApi";

export const UploadModal = () => {
  const pluginApi = usePluginAPI();
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: { allowedFileTypes: SUPPORTED_IMAGE_EXTENSIONS },
    }).use(Tus, {
      endpoint: pluginApi.media.tusUploadUrl,
      headers: {
        "csrf-token": appData.getCSRFToken(),
        "organization-id": pluginApi.pluginContext.organizationId,
      },
      chunkSize: pluginApi.env.getMediaUploadChunkSize(),
    }),
  );
  const sceneData = pluginApi.scene.useValtioData();

  useUppyEvent(uppy, "upload-success", (file) => {
    const splitted = file?.tus?.uploadUrl?.split("/");
    const fileName = splitted?.[splitted.length - 1];
    const { mediaId, extension } = extractMediaName(fileName ?? "");

    sceneData.pluginData.images.push({ mediaId, extension });
  });

  const { isOpen, onToggle } = useDisclosure();

  return (
    <>
      <Button
        size="xs"
        bg="transparent"
        color="white"
        border="1px solid #ffffff6b"
        _hover={{ bg: "rgba(255, 255, 255, 0.13)" }}
        onClick={onToggle}
      >
        <VscAdd />
        <Text ml={1} fontWeight="normal" fontSize="xs">
          Add
        </Text>
      </Button>
      <DashboardModal open={isOpen} uppy={uppy} />
    </>
  );
};
