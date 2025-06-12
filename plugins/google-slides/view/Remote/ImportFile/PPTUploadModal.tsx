import { appData } from "@repo/lib";
import { useDisclosure } from "@repo/ui";
import Uppy from "@uppy/core";
import { DashboardModal, useUppyEvent } from "@uppy/react";
import Tus from "@uppy/tus";
import { useState } from "react";
import { RiFilePpt2Fill } from "react-icons/ri";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { PickerCard } from "../component/PickerCard";

export const PPTUploadModal = () => {
  const pluginApi = usePluginAPI();

  const { open, onToggle, onClose } = useDisclosure();

  const [uppy] = useState(() =>
    new Uppy({
      restrictions: { allowedFileTypes: [".ppt", ".pptx"] },
    }).use(Tus, {
      endpoint: pluginApi.media.tusUploadUrl,
      headers: {
        "csrf-token": appData.getCSRFToken(),
        "organization-id": pluginApi.pluginContext.organizationId,
      },
      chunkSize: pluginApi.env.getMediaUploadChunkSize(),
    }),
  );

  const { mutateAsync: selectPpt, isPending } =
    trpc.googleslides.selectPpt.useMutation();

  useUppyEvent(uppy, "upload-success", async (file) => {
    const splitted = file?.tus?.uploadUrl?.split("/");
    const fileName = splitted?.[splitted.length - 1];

    await selectPpt({
      mediaName: fileName ?? "",
      pluginId: pluginApi.pluginContext.pluginId,
    });
    onClose();
  });

  return (
    <div className="flex-1">
      <PickerCard
        onClick={onToggle}
        icon={<RiFilePpt2Fill className="size-10 text-[#CC4A34]" />}
        text="Powerpoint"
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
