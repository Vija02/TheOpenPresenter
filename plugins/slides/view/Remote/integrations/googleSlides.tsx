import { useRef } from "react";
import { FcGoogle } from "react-icons/fc";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { SlidePicker } from "../ImportFile/SlidePicker";
import {
  IntegrationControllerProps,
  IntegrationLaunchContext,
  SlideIntegration,
} from "./types";

const GoogleSlidesController = ({ children }: IntegrationControllerProps) => {
  const pluginApi = usePluginAPI();
  const selectSlideMutation = trpc.slides.selectSlide.useMutation();

  const launchContextRef = useRef<IntegrationLaunchContext>({});

  return (
    <SlidePicker
      onFileSelected={(doc, token) => {
        selectSlideMutation.mutate({
          pluginId: pluginApi.pluginContext.pluginId,
          presentationId: doc.id,
          token: token,
          name: doc.name,
          replaceImportId: launchContextRef.current.replaceImportId,
        });

        launchContextRef.current.onComplete?.();
      }}
    >
      {({ isLoading, openPicker }) =>
        children({
          isLoading: isLoading || selectSlideMutation.isPending,
          open: (context) => {
            launchContextRef.current = context ?? {};
            openPicker();
          },
        })
      }
    </SlidePicker>
  );
};

export const googleSlidesIntegration: SlideIntegration = {
  id: "googleslides",
  name: "Google Slides",
  icon: <FcGoogle className="size-10" />,
  Controller: GoogleSlidesController,
};
