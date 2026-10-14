import { PluginAPIContext } from "@repo/base-plugin/client";
import { LayoutDoc, activeFeeds, cloneDoc } from "@repo/layout";
import { LayoutInsertDefaults, LayoutWorkbench } from "@repo/layout/editor";
import { useFeedData } from "@repo/layout/react";
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

import { useOutputs } from "../useOutputs";
import { useFeedSourceResolver } from "./useFeedSourceResolver";
import { useLayoutEditorApis } from "./useLayoutEditorApis";
import { useRendererHostCatalog } from "./useRendererHostCatalog";

const INSERT_DEFAULTS: LayoutInsertDefaults = {
  fills: { video: { playback: "loop" } },
};

type LayoutEditorModalProps = {
  isOpen: boolean;
  outputId: string;
  onClose: () => void;
};

const LayoutEditorModal = ({
  isOpen,
  outputId,
  onClose,
}: LayoutEditorModalProps) => {
  const { outputs, writableOutputs } = useOutputs();
  const output = outputs[outputId];

  const hostCatalog = useRendererHostCatalog(outputId);

  const { mediaPickerApi, videoPluginApi } = useLayoutEditorApis();

  const doc = output?.layout ?? null;

  const feeds = useMemo(() => (doc ? activeFeeds(doc) : []), [doc]);
  const resolveFeedSources = useFeedSourceResolver();
  const feedData = useFeedData(feeds, resolveFeedSources);

  const handleChange = useCallback(
    (next: LayoutDoc) => {
      const target = writableOutputs()[outputId];
      if (target) target.layout = cloneDoc(next);
    },
    [writableOutputs, outputId],
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
            Layout Settings - {output?.name ?? `Output ${outputId}`}
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
                data={feedData}
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
