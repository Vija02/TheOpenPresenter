import { Button, Text, useDisclosure } from "@chakra-ui/react";
import { appData } from "@repo/lib";
import Uppy from "@uppy/core";
import { DashboardModal, useUppyEvent } from "@uppy/react";
import XHR from "@uppy/xhr-upload";
import { useState } from "react";
import { VscAdd } from "react-icons/vsc";

import { usePluginAPI } from "../pluginApi";

export const UploadModal = () => {
  const pluginApi = usePluginAPI();
  const [uppy] = useState(() =>
    new Uppy().use(XHR, {
      endpoint: pluginApi.media.formDataUploadUrl,
      headers: {
        "csrf-token": appData.getCSRFToken(),
        "organization-id": pluginApi.pluginContext.organizationId,
      },
    }),
  );
  const sceneData = pluginApi.scene.useValtioData();

  useUppyEvent(uppy, "upload-success", (_file, response) => {
    const url = (response.body as any)?.url as string;

    sceneData.pluginData.images.push(url);
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
