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

  const mutableSceneData = pluginApi.scene.useValtioData();

  const selectSlideMutation = trpc.googleslides.selectSlide.useMutation();
  return (
    <div className="flex gap-2 w-full max-w-lg">
      <SlidePicker
        onFileSelected={(data, token) => {
          const picker = google.picker;
          if (data[picker.Response.ACTION] === "picked") {
            if (
              data[picker.Response.DOCUMENTS] &&
              data[picker.Response.DOCUMENTS]!.length > 0
            ) {
              const docs = data[picker.Response.DOCUMENTS]![0]!;

              const id = docs[picker.Document.ID];

              selectSlideMutation.mutate({
                pluginId: pluginContext.pluginId,
                presentationId: id,
                token: token,
              });
              mutableSceneData.pluginData._isFetching = true;
            }
          }
        }}
      >
        {({ isLoading, openPicker }) => (
          <div className="flex-1">
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
