import { useOverlayToggle } from "@repo/ui";
import { useCallback } from "react";
import { FaImage } from "react-icons/fa6";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { PickerCard } from "../component/PickerCard";

type Props = {
  replaceImportId?: string;
};

export const ImageUploadModal = ({ replaceImportId }: Props) => {
  const pluginApi = usePluginAPI();

  const { onToggle: onParentToggle } = useOverlayToggle();

  const { mutateAsync: selectImage, isPending } =
    trpc.slides.selectImage.useMutation();

  const handleClick = useCallback(async () => {
    const results = await pluginApi.mediaPicker.show({
      type: "image",
      title: replaceImportId ? "Select Image" : "Select Images",
      multiple: !replaceImportId,
    });

    if (!results || results.length === 0) return;

    try {
      await selectImage({
        images: results.map((r) => ({
          mediaName: r.mediaName,
          name: r.originalName ?? undefined,
        })),
        pluginId: pluginApi.pluginContext.pluginId,
        replaceImportId,
      });
    } catch (err: any) {
      pluginApi.remote.toast.error(`Failed to import Image: ${err?.message}`, {
        toastId: "slides--imageImportError",
      });
    }

    onParentToggle?.();
  }, [
    pluginApi.mediaPicker,
    pluginApi.pluginContext.pluginId,
    pluginApi.remote,
    selectImage,
    replaceImportId,
    onParentToggle,
  ]);

  return (
    <div className="flex justify-center flex-1">
      <PickerCard
        onClick={handleClick}
        icon={<FaImage className="size-10 text-[#515151]" />}
        text="Image"
        isLoading={isPending}
      />
    </div>
  );
};