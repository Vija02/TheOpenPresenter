import {
  SUPPORTED_IMAGE_EXTENSIONS,
  appData,
  extractMediaName,
} from "@repo/lib";
import { Button, useDisclosure } from "@repo/ui";
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
        "project-id": pluginApi.pluginContext.projectId,
        "plugin-id": pluginApi.pluginContext.pluginId,
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

  const { open, onToggle } = useDisclosure();

  return (
    <>
      <Button size="xs" variant="pill" onClick={onToggle}>
        <VscAdd />
        Add
      </Button>
      <DashboardModal
        open={open}
        onRequestClose={onToggle}
        closeAfterFinish
        closeModalOnClickOutside
        uppy={uppy}
      />
    </>
  );
};
