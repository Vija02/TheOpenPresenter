import { useOverlayToggle } from "@repo/ui";
import { useCallback } from "react";
import { RiFilePpt2Fill } from "react-icons/ri";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { PickerCard } from "../component/PickerCard";

type Props = {
  replaceImportId?: string;
};

export const PPTUploadModal = ({ replaceImportId }: Props) => {
  const pluginApi = usePluginAPI();

  const { onToggle: onParentToggle } = useOverlayToggle();

  const { mutate: selectPpt, isPending } = trpc.slides.selectPpt.useMutation();

  const handleClick = useCallback(async () => {
    const results = await pluginApi.mediaPicker.show({
      type: "ppt",
      title: "Select or Upload PowerPoint",
      multiple: false,
    });

    const result = results?.[0];
    if (!result) return;

    selectPpt(
      {
        mediaName: result.mediaName,
        name: result.originalName ?? undefined,
        pluginId: pluginApi.pluginContext.pluginId,
        replaceImportId,
      },
      {
        onError: (err) => {
          pluginApi.remote.toast.error(
            `Failed to import PowerPoint: ${err.message}`,
            { toastId: "slides--pptImportError" },
          );
        },
      },
    );
    onParentToggle?.();
  }, [
    pluginApi.mediaPicker,
    pluginApi.pluginContext.pluginId,
    pluginApi.remote,
    selectPpt,
    replaceImportId,
    onParentToggle,
  ]);

  return (
    <div className="flex justify-center flex-1">
      <PickerCard
        onClick={handleClick}
        icon={<RiFilePpt2Fill className="size-10 text-[#CC4A34]" />}
        text="Powerpoint"
        isLoading={isPending}
      />
    </div>
  );
};
