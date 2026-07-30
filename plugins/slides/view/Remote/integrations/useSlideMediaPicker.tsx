import { useCallback, useRef } from "react";

import { usePluginAPI } from "../../pluginApi";
import { PickerCard } from "../component/PickerCard";
import { useMediaUpload } from "../useMediaUpload";
import { IntegrationSection, slideIntegrations } from "./IntegrationCards";
import { IntegrationController, IntegrationLaunchContext } from "./types";

export type PickMediaOptions = IntegrationLaunchContext & {
  multiple?: boolean;
};

export const useSlideMediaPicker = () => {
  const pluginApi = usePluginAPI();
  const { isProcessing, handleUploadComplete } = useMediaUpload();

  const controllersRef = useRef<Record<string, IntegrationController>>({});

  const integrationHosts = (
    <div className="hidden">
      {slideIntegrations.map(({ id, Controller }) => (
        <Controller key={id}>
          {(controller) => {
            controllersRef.current[id] = controller;
            return <span />;
          }}
        </Controller>
      ))}
    </div>
  );

  const pickMedia = useCallback(
    async ({ multiple = true, replaceImportId }: PickMediaOptions = {}) => {
      if (pluginApi.isPublicAccess) {
        pluginApi.remote.toast.error("Sign in to upload media.");
        return;
      }

      try {
        const results = await pluginApi.mediaPicker.show({
          type: ["image", "ppt", "pdf"],
          multiple,
          customComponent: (
            <IntegrationSection>
              {slideIntegrations.map(({ id, name, icon }) => (
                <PickerCard
                  key={id}
                  onClick={() => {
                    const controller = controllersRef.current[id];
                    if (!controller) {
                      pluginApi.remote.toast.error(
                        `${name} integration is not ready yet.`,
                      );
                      return;
                    }
                    controller.open({
                      replaceImportId,
                      onComplete: () => pluginApi.mediaPicker.close(),
                    });
                  }}
                  icon={icon}
                  text={name}
                  isLoading={false}
                />
              ))}
            </IntegrationSection>
          ),
        });

        if (!results || results.length === 0) return;

        await handleUploadComplete(
          results.map((file: any) => ({
            mediaName: file.mediaName,
            originalName: file.originalName ?? null,
          })),
          replaceImportId,
        );
      } catch (err: any) {
        if (err !== "cancelled") {
          pluginApi.remote.toast.error(
            `Failed to open media picker: ${err?.message || err}`,
          );
        }
      }
    },
    [handleUploadComplete, pluginApi],
  );

  return { integrationHosts, pickMedia, isProcessing };
};
