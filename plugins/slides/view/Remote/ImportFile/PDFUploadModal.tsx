import { useOverlayToggle } from "@repo/ui";
import { useCallback } from "react";
import { FaFilePdf } from "react-icons/fa";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { PickerCard } from "../component/PickerCard";

type Props = {
  replaceImportId?: string;
};

export const PDFUploadModal = ({ replaceImportId }: Props) => {
  const pluginApi = usePluginAPI();

  const { onToggle: onParentToggle } = useOverlayToggle();

  const { mutate: selectPdf, isPending } =
    trpc.slides.selectPdf.useMutation();

  const handleClick = useCallback(async () => {
    const results = await pluginApi.mediaPicker.show({
      type: "pdf",
      title: "Select or Upload PDF",
      multiple: false,
    });

    const result = results?.[0];
    if (!result) return;

    selectPdf({
      mediaName: result.mediaName,
      name: result.originalName ?? undefined,
      pluginId: pluginApi.pluginContext.pluginId,
      replaceImportId,
    });
    onParentToggle?.();
  }, [
    pluginApi.mediaPicker,
    pluginApi.pluginContext.pluginId,
    selectPdf,
    replaceImportId,
    onParentToggle,
  ]);

  return (
    <div className="flex justify-center flex-1">
      <PickerCard
        onClick={handleClick}
        icon={<FaFilePdf className="size-10 text-[#F52102]" />}
        text="PDF"
        isLoading={isPending}
      />
    </div>
  );
};
