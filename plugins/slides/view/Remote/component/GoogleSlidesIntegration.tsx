import { PublicAccessNoticeDialog } from "@repo/base-plugin/client";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { SlidePicker } from "../ImportFile/SlidePicker";
import { PickerCard } from "./PickerCard";

export const GoogleSlidesIntegration = ({
  replaceImportId,
}: {
  replaceImportId?: string;
}) => {
  const pluginApi = usePluginAPI();
  const [showPublicNotice, setShowPublicNotice] = useState(false);
  const selectSlideMutation = trpc.slides.selectSlide.useMutation();

  return (
    <>
      <SlidePicker
        onFileSelected={(doc, token) => {
          selectSlideMutation.mutate({
            pluginId: pluginApi.pluginContext.pluginId,
            presentationId: doc.id,
            token: token,
            name: doc.name,
            replaceImportId,
          });
        }}
      >
        {({ isLoading, openPicker }) => (
          <PickerCard
            onClick={() => {
              if (pluginApi.isPublicAccess) {
                setShowPublicNotice(true);
                return;
              }
              openPicker();
            }}
            icon={<FcGoogle className="size-10" />}
            text="Google Slides"
            isLoading={isLoading || selectSlideMutation.isPending}
          />
        )}
      </SlidePicker>

      <PublicAccessNoticeDialog
        isOpen={showPublicNotice}
        onClose={() => setShowPublicNotice(false)}
      />
    </>
  );
};