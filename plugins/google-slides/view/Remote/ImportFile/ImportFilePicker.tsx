import { useOverlayToggle } from "@repo/ui";
import { FcGoogle } from "react-icons/fc";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { PickerCard } from "../component/PickerCard";
import { PDFUploadModal } from "./PDFUploadModal";
import { PPTUploadModal } from "./PPTUploadModal";
import { SlidePicker } from "./SlidePicker";

export const ImportFilePicker = () => {
  const pluginApi = usePluginAPI();
  const pluginContext = pluginApi.pluginContext;

  const { onToggle } = useOverlayToggle();

  const mutableSceneData = pluginApi.scene.useValtioData();

  const selectSlideMutation = trpc.googleslides.selectSlide.useMutation();
  return (
    <div className="flex gap-2 w-full max-w-lg flex-wrap">
      <SlidePicker
        onFileSelected={(doc, token) => {
          selectSlideMutation.mutate({
            pluginId: pluginContext.pluginId,
            presentationId: doc.id,
            token: token,
          });
          mutableSceneData.pluginData._isFetching = true;
          onToggle?.();
        }}
      >
        {({ isLoading, openPicker }) => (
          <div className="flex justify-center flex-1">
            <PickerCard
              onClick={openPicker}
              icon={<FcGoogle className="size-10" />}
              text="Google Slides"
              isLoading={isLoading}
            />
          </div>
        )}
      </SlidePicker>
      <PDFUploadModal />
      <PPTUploadModal />
    </div>
  );
};
