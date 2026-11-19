import { readLinkedFile, watchLinkedFiles } from "@repo/desktop-bridge";
import { uploadFile } from "@repo/media-picker/client";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { ImportData, LinkedFile, PptImportData } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { useLinkingNodeId } from "./useLinkOrImport";

const BUSY_RETRY_MS = 3000;

const sha256Hex = async (bytes: Uint8Array<ArrayBuffer>) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");

const linkedHere = (
  imports: Record<string, ImportData>,
  nodeId: string,
): (PptImportData & { linkedFile: LinkedFile })[] =>
  Object.values(imports).filter(
    (imp): imp is PptImportData & { linkedFile: LinkedFile } =>
      imp.type === "ppt" && imp.linkedFile?.watchedBy === nodeId,
  );

/** Watches the files linked on this computer and re-imports them when saved */
export const useLinkedFileSync = () => {
  const pluginApi = usePluginAPI();
  const watcherId = useLinkingNodeId();
  const imports = pluginApi.scene.useData((x) => x.pluginData.imports);
  const { mutateAsync: selectPpt } = trpc.slides.selectPpt.useMutation();

  const pathsKey = useMemo(
    () =>
      watcherId
        ? [
            ...new Set(
              linkedHere(imports ?? {}, watcherId).map(
                (imp) => imp.linkedFile.path,
              ),
            ),
          ]
            .sort()
            .join("\0")
        : "",
    [imports, watcherId],
  );

  const latest = useRef({ imports, watcherId, selectPpt, pluginApi });
  latest.current = { imports, watcherId, selectPpt, pluginApi };
  const runs = useRef(new Map<string, { again: boolean }>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const sync = useCallback(async (filePath: string): Promise<void> => {
    const running = runs.current.get(filePath);
    if (running) {
      running.again = true;
      return;
    }
    const run = { again: false };
    runs.current.set(filePath, run);
    // Already re-imported in this run, in case `latest` hasn't caught up
    const done = new Set<string>();
    try {
      do {
        run.again = false;
        const { imports, watcherId, selectPpt, pluginApi } = latest.current;
        if (!watcherId || !mounted.current) return;
        const linked = linkedHere(imports ?? {}, watcherId).filter(
          (imp) => imp.linkedFile.path === filePath && !done.has(imp.importId),
        );
        if (linked.length === 0) return;
        if (linked.some((imp) => imp._isFetching)) {
          setTimeout(() => void sync(filePath), BUSY_RETRY_MS);
          return;
        }

        const bytes = new Uint8Array(await readLinkedFile(filePath));
        const sha256 = await sha256Hex(bytes);
        // The same file can be linked more than once
        const imp = linked.find((i) => i.linkedFile.sha256 !== sha256);
        if (!imp) continue;
        done.add(imp.importId);

        if (!mounted.current) return;
        const name = filePath.split(/[\\/]/).pop() ?? "deck.pptx";
        const { pluginId, organizationId, projectId } = pluginApi.pluginContext;
        const { mediaName } = await uploadFile(new File([bytes], name), {
          organizationId,
          projectId,
          pluginId,
        });
        await selectPpt({
          pluginId,
          mediaName,
          name: imp.name ?? name,
          replaceImportId: imp.importId,
          link: { path: filePath, watchedBy: watcherId },
        });
        run.again = true;
      } while (run.again);
    } catch (err) {
      // A failed import shows on the import itself; this is for the rest
      console.warn("Couldn't update the slides from", filePath, err);
    } finally {
      runs.current.delete(filePath);
    }
  }, []);

  useEffect(() => {
    if (!pathsKey) return;
    return watchLinkedFiles(pathsKey.split("\0"), (filePath) => {
      void sync(filePath);
    });
  }, [pathsKey, sync]);
};
