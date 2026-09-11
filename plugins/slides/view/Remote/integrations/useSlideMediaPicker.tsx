import { Option } from "@repo/ui";
import { useCallback, useRef } from "react";
import { FaLink } from "react-icons/fa6";
import { RiSlideshowLine } from "react-icons/ri";

import { IntegrationSection } from "../../components/IntegrationSection";
import { PickerCard } from "../../components/PickerCard";
import { usePluginAPI } from "../../pluginApi";
import { useMediaUpload } from "../useMediaUpload";
import { slideIntegrations } from "./IntegrationCards";
import { IntegrationController, IntegrationLaunchContext } from "./types";

export type PickMediaOptions = IntegrationLaunchContext & {
  multiple?: boolean;
  onCreateFromScratch?: () => void;
  onCollectFromOthers?: () => void;
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
    async ({
      multiple = true,
      replaceImportId,
      onCreateFromScratch,
      onCollectFromOthers,
    }: PickMediaOptions = {}) => {
      if (pluginApi.isPublicAccess) {
        pluginApi.remote.toast.error("Sign in to upload media.");
        return;
      }

      try {
        const results = await pluginApi.mediaPicker.show({
          type: ["image", "ppt", "pdf"],
          multiple,
          customComponent: (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                {onCreateFromScratch && (
                  <Option
                    size="lg"
                    className="flex-1"
                    onClick={() => {
                      pluginApi.mediaPicker.close();
                      onCreateFromScratch();
                    }}
                    testId="slides-create-from-scratch"
                    title={
                      <span className="flex items-center gap-3">
                        <RiSlideshowLine className="size-6 shrink-0 text-secondary" />
                        Create slides from scratch
                      </span>
                    }
                    description="Design your own slides directly in TheOpenPresenter."
                  />
                )}

                <Option
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    pluginApi.mediaPicker.close();
                    onCollectFromOthers?.();
                  }}
                  testId="slides-collect-from-others"
                  title={
                    <span className="flex items-center gap-3">
                      <FaLink className="size-5 shrink-0 text-secondary" />
                      Collect slides from others
                    </span>
                  }
                  description="Share a link so people can send you slides."
                />
              </div>

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
            </div>
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
