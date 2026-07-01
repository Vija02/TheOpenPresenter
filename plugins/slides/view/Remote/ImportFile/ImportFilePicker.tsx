import { PublicAccessNoticeDialog } from "@repo/base-plugin/client";
import { useOverlayToggle } from "@repo/ui";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { PickerCard } from "../component/PickerCard";
import { PDFUploadModal } from "./PDFUploadModal";
import { PPTUploadModal } from "./PPTUploadModal";
import { SlidePicker } from "./SlidePicker";
import { ImageUploadModal } from "./ImageUploadModal";

type Props = {
  replaceImportId?: string;
};

export const ImportFilePicker = ({ replaceImportId }: Props) => {
  const pluginApi = usePluginAPI();
  const pluginContext = pluginApi.pluginContext;
  const isPublicAccess = pluginApi.isPublicAccess;

  const { onToggle } = useOverlayToggle();

  const [showSlidesPublicNotice, setShowSlidesPublicNotice] = useState(false);

  const selectSlideMutation = trpc.slides.selectSlide.useMutation();
  return (
    <div className="flex gap-2 w-full max-w-lg flex-wrap">
      <SlidePicker
        onFileSelected={(doc, token) => {
          selectSlideMutation.mutate({
            pluginId: pluginContext.pluginId,
            presentationId: doc.id,
            token: token,
            name: doc.name,
            replaceImportId,
          });
          onToggle?.();
        }}
      >
        {({ isLoading, openPicker }) => (
          <div className="flex justify-center flex-1">
            <PickerCard
              onClick={() => {
                if (isPublicAccess) {
                  setShowSlidesPublicNotice(true);
                  return;
                }
                openPicker();
              }}
              icon={<FcGoogle className="size-10" />}
              text="Google Slides"
              isLoading={isLoading}
            />
          </div>
        )}
      </SlidePicker>
      
      <PDFUploadModal replaceImportId={replaceImportId} />
      <PPTUploadModal replaceImportId={replaceImportId} />
      <ImageUploadModal replaceImportId={replaceImportId} />

      <PublicAccessNoticeDialog
        isOpen={showSlidesPublicNotice}
        onClose={() => setShowSlidesPublicNotice(false)}
      />
    </div>
  );
};