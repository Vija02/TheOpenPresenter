import { PublicAccessNoticeDialog } from "@repo/base-plugin/client";
import { ReactNode, useState } from "react";

import { usePluginAPI } from "../../pluginApi";
import { PickerCard } from "../component/PickerCard";
import { googleSlidesIntegration } from "./googleSlides";
import { IntegrationLaunchContext, SlideIntegration } from "./types";

export const slideIntegrations: SlideIntegration[] = [googleSlidesIntegration];

export const IntegrationSection = ({
  children,
  title = "Or import from integration",
  className = "",
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) => (
  <div className={`flex flex-col gap-3 ${className}`}>
    <p className="text-lg font-semibold text-primary">{title}</p>
    <div className="flex flex-wrap gap-4">{children}</div>
  </div>
);

export const IntegrationCards = ({
  replaceImportId,
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
                open({ replaceImportId });
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
