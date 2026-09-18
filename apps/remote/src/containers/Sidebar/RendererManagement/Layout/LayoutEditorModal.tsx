import { staticOutputVolume } from "@repo/base-plugin";
import {
  PluginAPIContext,
  initStandalonePluginApi,
  useMediaPicker,
} from "@repo/base-plugin/client";
import {
  useCompleteMediaMutation,
  useDeleteMediaMutation,
} from "@repo/graphql";
import { LayoutDoc, cloneDoc, readRendererLayoutDoc } from "@repo/layout";
import {
  LayoutInsertDefaults,
  LayoutPluginApi,
  LayoutWorkbench,
} from "@repo/layout/editor";
import { uuidFromMediaIdOrUUIDOrMediaName } from "@repo/lib";
import {
  useAudioCheck,
  useData,
  useError,
  usePluginData,
  usePluginMetaData,
} from "@repo/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { useCallback, useMemo } from "react";

import { useRendererHostCatalog } from "./useRendererHostCatalog";

const INSERT_DEFAULTS: LayoutInsertDefaults = {
  fills: { video: { playback: "loop" } },
};

type LayoutEditorModalProps = {
  isOpen: boolean;
  rendererId: string;
  onClose: () => void;
};

const LayoutEditorModal = ({
  isOpen,
  rendererId,
  onClose,
}: LayoutEditorModalProps) => {
  const data = useData();
  const mainState = usePluginData().mainState!;

  const hostCatalog = useRendererHostCatalog(rendererId);

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

  const doc = useMemo(
    () => readRendererLayoutDoc(data.renderer[rendererId]?.layout),
    [data.renderer, rendererId],
  );

  const { canPlayAudio } = useAudioCheck();
  const { addError, removeError } = useError();
  const [, deleteMedia] = useDeleteMediaMutation();
  const [, completeMedia] = useCompleteMediaMutation();

  // Some things like video needs plugin API. Since we're outside a plugin this becomes a problem
  // So just create a standalone one for that
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

  const handleChange = useCallback(
    (next: LayoutDoc) => {
      const renderer = mainState.renderer[rendererId];
      if (!renderer?.layout) return;

      renderer.layout = {
        enabled: renderer.layout.enabled ?? true,
        doc: cloneDoc(next),
      };
    },
    [mainState.renderer, rendererId],
  );

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent
        size="full"
        className="desktop:w-[96vw] desktop:max-w-[1500px] desktop:h-[90vh] flex flex-col p-0 gap-0"
      >
        <DialogHeader className="px-4 py-3 border-b border-stroke shrink-0">
          <DialogTitle>
            <button
              onClick={onClose}
              className="text-tertiary hover:text-primary mr-2"
            >
              &larr;
            </button>
            Layout Settings - Screen {rendererId}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex-1 min-h-0 p-0 overflow-hidden">
          {doc && (
            <PluginAPIContext.Provider value={{ pluginAPI: videoPluginApi }}>
              <LayoutWorkbench
                doc={doc}
                onChange={handleChange}
                hostCatalog={hostCatalog}
                pluginApi={mediaPickerApi}
                insertDefaults={INSERT_DEFAULTS}
                ai={false}
              />
            </PluginAPIContext.Provider>
          )}
        </DialogBody>

        <DialogFooter className="px-4 py-3 border-t border-stroke shrink-0">
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LayoutEditorModal;
