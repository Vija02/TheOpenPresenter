import { PublicAccessNoticeDialog } from "@repo/base-plugin/client";
import { useState } from "react";

import { PickerCard } from "../../components/PickerCard";
import { usePluginAPI } from "../../pluginApi";
import { canvaIntegration } from "./canva";
import { googleSlidesIntegration } from "./googleSlides";
import { IntegrationLaunchContext, SlideIntegration } from "./types";

export const slideIntegrations: SlideIntegration[] = [
  googleSlidesIntegration,
  canvaIntegration,
];

export const IntegrationCards = ({
  replaceImportId,
  onComplete,
}: IntegrationLaunchContext = {}) => {
  const pluginApi = usePluginAPI();
  const [showPublicNotice, setShowPublicNotice] = useState(false);

  return (
    <>
      {slideIntegrations.map(({ id, name, icon, Controller }) => (
        <Controller key={id}>
          {({ isLoading, open }) => (
            <PickerCard
              onClick={() => {
                if (pluginApi.isPublicAccess) {
                  setShowPublicNotice(true);
                  return;
                }
                open({ replaceImportId, onComplete });
              }}
              icon={icon}
              text={name}
              isLoading={isLoading}
            />
          )}
        </Controller>
      ))}

      <PublicAccessNoticeDialog
        isOpen={showPublicNotice}
        onClose={() => setShowPublicNotice(false)}
      />
    </>
  );
};
