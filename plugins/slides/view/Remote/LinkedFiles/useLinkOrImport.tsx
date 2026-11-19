import { getNodeId, getPathForFile } from "@repo/desktop-bridge";
import { uploadFile } from "@repo/media-picker/client";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { classifySlideFile } from "../../../src/importers/fileTypes";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";

type Choice = "link" | "import" | "cancel";

/** This computer's id, when it can link files (Studio, local server) */
export const useLinkingNodeId = () => {
  const pluginApi = usePluginAPI();
  const [nodeId, setNodeId] = useState<string | null>(null);
  const enabled =
    !pluginApi.isPublicAccess &&
    pluginApi.env.getCustomEnv("PLUGIN_SLIDES_LINKED_FILES") === "1";

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void getNodeId().then((id) => live && setNodeId(id));
    return () => {
      live = false;
    };
  }, [enabled]);

  return enabled ? nodeId : null;
};

/**
 * In Studio, asks whether a PowerPoint file should be linked (re-imported
 * whenever it's saved) or imported as a copy. Feeds Dropzone's `beforeUpload`.
 */
export const useLinkOrImport = () => {
  const pluginApi = usePluginAPI();
  const nodeId = useLinkingNodeId();
  const { mutateAsync: selectPpt } = trpc.slides.selectPpt.useMutation();
  const [isLinking, setIsLinking] = useState(false);
  const [pending, setPending] = useState<{
    names: string[];
    resolve: (choice: Choice) => void;
  } | null>(null);

  // Closing the page mid-question drops the files rather than leaving them waiting
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => () => pendingRef.current?.resolve("cancel"), []);

  const link = useCallback(
    async (file: File, filePath: string, watchedBy: string) => {
      const { pluginId, organizationId, projectId } = pluginApi.pluginContext;
      const { mediaName } = await uploadFile(file, {
        organizationId,
        projectId,
        pluginId,
      });
      await selectPpt({
        pluginId,
        mediaName,
        name: file.name,
        link: { path: filePath, watchedBy },
      });
    },
    [pluginApi, selectPpt],
  );

  const beforeUpload = useCallback(
    async (files: File[]) => {
      if (!nodeId) return files;
      const linkable = files.flatMap((file) => {
        const filePath =
          classifySlideFile(file.name) === "ppt" ? getPathForFile(file) : null;
        return filePath ? [{ file, filePath }] : [];
      });
      if (linkable.length === 0) return files;

      const choice = await new Promise<Choice>((resolve) =>
        setPending({ names: linkable.map((l) => l.file.name), resolve }),
      );
      setPending(null);
      if (choice === "import") return files;
      if (choice === "cancel") return [];

      setIsLinking(true);
      void Promise.all(
        linkable.map(({ file, filePath }) =>
          link(file, filePath, nodeId).catch((err) =>
            pluginApi.remote.toast.error(
              `Couldn't link ${file.name}: ${err?.message ?? err}`,
            ),
          ),
        ),
      ).finally(() => setIsLinking(false));
      return files.filter((f) => !linkable.some((l) => l.file === f));
    },
    [link, nodeId, pluginApi],
  );

  const dialog = (
    <Dialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) pending?.resolve("cancel");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link or import?</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2">
          <p className="font-medium break-all">{pending?.names.join(", ")}</p>
          <p>
            <b>Link</b> keeps the slides updated with the file: whenever it's
            saved on this computer, they update.
          </p>
          <p>
            <b>Import</b> takes a copy as it is now.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => pending?.resolve("import")}
            data-testid="slides-import-copy"
          >
            Import
          </Button>
          <Button
            onClick={() => pending?.resolve("link")}
            data-testid="slides-link-file"
          >
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    beforeUpload: nodeId ? beforeUpload : undefined,
    isLinking,
    dialog,
  };
};
