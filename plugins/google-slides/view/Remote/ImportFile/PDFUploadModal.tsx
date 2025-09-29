import { appData } from "@repo/lib";
import { useDisclosure } from "@repo/ui";
import Uppy from "@uppy/core";
import { DashboardModal, useUppyEvent } from "@uppy/react";
import Tus from "@uppy/tus";
import { useState } from "react";
import { FaFilePdf } from "react-icons/fa";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { PickerCard } from "../component/PickerCard";

export const PDFUploadModal = () => {
  const pluginApi = usePluginAPI();

  const { open, onToggle, onClose } = useDisclosure();

  const [uppy] = useState(() =>
    new Uppy({
      restrictions: { allowedFileTypes: [".pdf"] },
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

  const { mutateAsync: selectPdf, isPending } =
    trpc.googleslides.selectPdf.useMutation();

  useUppyEvent(uppy, "upload-success", async (file) => {
    const splitted = file?.tus?.uploadUrl?.split("/");
    const fileName = splitted?.[splitted.length - 1];

    await selectPdf({
      mediaName: fileName ?? "",
      pluginId: pluginApi.pluginContext.pluginId,
    });
    onClose();
  });

  return (
    <div className="flex justify-center flex-1">
      <PickerCard
        onClick={onToggle}
        icon={<FaFilePdf className="size-10 text-[#F52102]" />}
        text="PDF"
        isLoading={isPending}
      />
      <DashboardModal
        open={open}
        onRequestClose={onToggle}
        closeAfterFinish
        closeModalOnClickOutside
        uppy={uppy}
      />
    </div>
  );
};
