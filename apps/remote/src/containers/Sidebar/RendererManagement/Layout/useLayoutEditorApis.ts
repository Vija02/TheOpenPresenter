import { staticOutputVolume } from "@repo/base-plugin";
import {
  initStandalonePluginApi,
  useMediaPicker,
} from "@repo/base-plugin/client";
import {
  useCompleteMediaMutation,
  useDeleteMediaMutation,
} from "@repo/graphql";
import { LayoutPluginApi } from "@repo/layout/editor";
import { uuidFromMediaIdOrUUIDOrMediaName } from "@repo/lib";
import { useAudioCheck, useError, usePluginMetaData } from "@repo/shared";
import { useMemo } from "react";

export const useLayoutEditorApis = () => {
  const mediaPicker = useMediaPicker();
  const { orgId, projectId } = usePluginMetaData();

  const mediaPickerApi = useMemo<LayoutPluginApi>(
    () => ({
      mediaPicker,
      pluginContext: {
        organizationId: orgId,
        projectId,
        pluginId: "",
        sceneId: "",
      },
    }),
    [mediaPicker, orgId, projectId],
  );

  const { canPlayAudio } = useAudioCheck();
  const { addError, removeError } = useError();
  const [, deleteMedia] = useDeleteMediaMutation();
  const [, completeMedia] = useCompleteMediaMutation();

  const videoPluginApi = useMemo(
    () =>
      initStandalonePluginApi({
        pluginContext: {
          organizationId: orgId,
          projectId,
          pluginId: "",
          sceneId: "",
        },
        misc: {
          canPlayAudio,
          outputVolume: staticOutputVolume,
          errorHandler: { addError, removeError },
          mediaPicker,
          media: {
            permanentlyDeleteMedia: (mediaKey: string) =>
              deleteMedia({ id: uuidFromMediaIdOrUUIDOrMediaName(mediaKey) }),
            completeMedia: (mediaKey: string) =>
              completeMedia({ id: uuidFromMediaIdOrUUIDOrMediaName(mediaKey) }),
            // No plugin owns this layout, so there is nothing to unlink.
            unlinkMediaFromPlugin: () => Promise.resolve(),
          },
          surface: "remote",
        },
      }),
    [
      canPlayAudio,
      orgId,
      projectId,
      addError,
      removeError,
      mediaPicker,
      deleteMedia,
      completeMedia,
    ],
  );

  return { mediaPickerApi, videoPluginApi };
};
