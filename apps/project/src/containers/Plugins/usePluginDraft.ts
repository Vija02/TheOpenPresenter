import {
  useClientPluginDraftQuery,
  useClientPluginVersionSourceQuery,
  useUpsertClientPluginDraftMutation,
} from "@repo/graphql";
import { useEffect, useRef, useState } from "react";

import { parseManifestSafe, withRequiredFiles } from "./pluginFiles";
import { STARTER } from "./starterTemplate";
import { Plugin } from "./types";

/**
 * Loads the draft (or latest published version, or starter) once, then
 * autosaves changes back to the draft.
 */
export const usePluginDraft = (plugin: Plugin) => {
  const latestVersion = plugin.clientPluginVersions.nodes[0] ?? null;

  // The autosaved draft takes precedence over the latest built version.
  const [draftQuery] = useClientPluginDraftQuery({
    variables: { clientPluginId: plugin.id },
  });

  const [sourceQuery] = useClientPluginVersionSourceQuery({
    variables: { versionId: latestVersion?.id },
    pause: !latestVersion,
  });

  const [, upsertDraft] = useUpsertClientPluginDraftMutation();

  const [files, setFiles] = useState<Record<string, string>>(STARTER);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const initialized = useRef(false);

  // Waits for both queries to settle
  useEffect(() => {
    if (initialized.current) return;
    if (draftQuery.fetching) return;
    if (latestVersion && sourceQuery.fetching) return;

    const draftSrc = draftQuery.data?.clientPluginDraft?.source as
      | Record<string, string>
      | undefined;
    const versionSrc = sourceQuery.data?.clientPluginVersion?.source as
      | Record<string, string>
      | undefined;

    if (draftSrc && Object.keys(draftSrc).length > 0) {
      setFiles(withRequiredFiles(draftSrc));
      setSavedAt(draftQuery.data?.clientPluginDraft?.updatedAt ?? null);
    } else if (versionSrc && Object.keys(versionSrc).length > 0) {
      setFiles(withRequiredFiles(versionSrc));
    }
    initialized.current = true;
  }, [
    draftQuery.fetching,
    draftQuery.data,
    latestVersion,
    sourceQuery.fetching,
    sourceQuery.data,
  ]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!initialized.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await upsertDraft({
          input: {
            clientPluginId: plugin.id,
            source: files,
            manifest: parseManifestSafe(files),
          },
        });
        setSavedAt(new Date().toISOString());
      } catch {
        // Non-fatal; will retry on next change.
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, plugin.id]);

  return { files, setFiles, savedAt };
};
