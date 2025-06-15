import { Box, chakra } from "@chakra-ui/react";
import { FcGoogle as FcGoogleRaw } from "react-icons/fc";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { SlidePicker } from "./SlidePicker";
import { PickerCard } from "../component/PickerCard";
import { PDFUploadModal } from "./PDFUploadModal";
import { PPTUploadModal } from "./PPTUploadModal";

const FcGoogle = chakra(FcGoogleRaw);

export const ImportFilePicker = () => {
  const pluginApi = usePluginAPI();
  const pluginContext = pluginApi.pluginContext;

  const mutableSceneData = pluginApi.scene.useValtioData();

  const selectSlideMutation = trpc.googleslides.selectSlide.useMutation();
  return (
    <Box display="flex" gap={2}>
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
          <Box flex={1}>
            <PickerCard
              onClick={openPicker}
              icon={<FcGoogle fontSize="5xl" />}
              text="Google Slides"
              isLoading={isLoading}
            />
          </Box>
        )}
      </SlidePicker>
      <PDFUploadModal />
      <PPTUploadModal />
    </Box>
  );
};
