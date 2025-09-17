import { appData, extractMediaName } from "@repo/lib";
import { useOverlayToggle } from "@repo/ui";
import Uppy from "@uppy/core";
import { DashboardModal, useUppyEvent } from "@uppy/react";
import Tus from "@uppy/tus";
import { useState } from "react";
import { typeidUnboxed } from "typeid-js";

import { usePluginAPI } from "../pluginApi";

const UploadVideoModal = () => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const pluginApi = usePluginAPI();

  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        allowedFileTypes: ["video/*"],
      },
    }).use(Tus, {
      endpoint: pluginApi.media.tusUploadUrl,
      headers: {
        "csrf-token": appData.getCSRFToken(),
        "organization-id": pluginApi.pluginContext.organizationId,
      },
      chunkSize: pluginApi.env.getMediaUploadChunkSize(),
    }),
  );
  const mutableSceneData = pluginApi.scene.useValtioData();

  useUppyEvent(uppy, "upload-success", (file) => {
    const splitted = file?.tus?.uploadUrl?.split("/");
    const fileName = splitted?.[splitted.length - 1];

    mutableSceneData.pluginData.videos.push({
      id: typeidUnboxed("video"),
      metadata: { title: file?.name },
      url: pluginApi.media.resolveMediaUrl(extractMediaName(fileName ?? "")),
      isInternalVideo: true,
      hlsMediaName: null,
      thumbnailMediaName: null,
      transcodeRequested: false,
    });
    onToggle?.();
    resetData?.();
  });

  return (
    <DashboardModal
      open={isOpen}
      onRequestClose={onToggle}
      closeAfterFinish
      closeModalOnClickOutside
      uppy={uppy}
    />
  );
};

export default UploadVideoModal;
