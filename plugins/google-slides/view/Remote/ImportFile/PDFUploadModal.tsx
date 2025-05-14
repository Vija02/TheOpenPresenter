import { Box, chakra, useDisclosure } from "@chakra-ui/react";
import { appData } from "@repo/lib";
import Uppy from "@uppy/core";
import { DashboardModal, useUppyEvent } from "@uppy/react";
import Tus from "@uppy/tus";
import { useState } from "react";
import { FaFilePdf as FaFilePdfRaw } from "react-icons/fa";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { PickerCard } from "../component/PickerCard";

const FaFilePdf = chakra(FaFilePdfRaw);

export const PDFUploadModal = () => {
  const pluginApi = usePluginAPI();

  const { isOpen, onToggle, onClose } = useDisclosure();

  const [uppy] = useState(() =>
    new Uppy({
      restrictions: { allowedFileTypes: [".pdf"] },
    }).use(Tus, {
      endpoint: pluginApi.media.tusUploadUrl,
      headers: {
        "csrf-token": appData.getCSRFToken(),
        "organization-id": pluginApi.pluginContext.organizationId,
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
    <Box flex={1}>
      <PickerCard
        onClick={onToggle}
        icon={<FaFilePdf fontSize="5xl" color="#F52102" />}
        text="PDF"
        isLoading={isPending}
      />
      <DashboardModal
        open={isOpen}
        onRequestClose={onToggle}
        closeAfterFinish
        closeModalOnClickOutside
        uppy={uppy}
      />
    </Box>
  );
};
