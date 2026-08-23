import {
  ClientPluginBuildStatus,
  useBuildClientPluginVersionMutMutation,
  useCreateClientPluginVersionMutation,
  useTestBuildClientPluginMutation,
} from "@repo/graphql";
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { CodeEditor } from "./CodeEditor";
import { FileExplorer } from "./FileExplorer";
import { PublishPluginModal, PublishStage } from "./PublishPluginModal";
import {
  REQUIRED_FILES,
  highestBuiltVersion,
  isRequired,
  parseManifestSafe,
} from "./pluginFiles";
import { Plugin } from "./types";
import { usePluginDraft } from "./usePluginDraft";

export const PluginEditorModal = ({
  plugin,
  onClose,
  refetch,
}: {
  plugin: Plugin;
  onClose: () => void;
  refetch: () => void;
}) => {
  const { files, setFiles, savedAt } = usePluginDraft(plugin);

  const [, createVersion] = useCreateClientPluginVersionMutation();
  const [, buildVersion] = useBuildClientPluginVersionMutMutation();
  const [, testBuild] = useTestBuildClientPluginMutation();

  const [activeFile, setActiveFile] = useState<string>("remote.tsx");
  const [building, setBuilding] = useState(false);
  const [testing, setTesting] = useState(false);
  const [buildLog, setBuildLog] = useState<string | null>(null);
  const [buildOk, setBuildOk] = useState<boolean | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishStage, setPublishStage] = useState<PublishStage>("idle");
  const [publishError, setPublishError] = useState<string | null>(null);
  // Snapshot of the source that last passed a test build
  const [testedSource, setTestedSource] = useState<string | null>(null);

  const sourceKey = useMemo(() => JSON.stringify(files), [files]);
  const isTested = testedSource !== null && testedSource === sourceKey;

  const versionsList = plugin.clientPluginVersions.nodes;

  const latestBuiltVersion = useMemo(
    () => highestBuiltVersion(versionsList, ClientPluginBuildStatus.Built),
    [versionsList],
  );

  const onDeleteFile = useCallback(
    (name: string) => {
      if (isRequired(name)) return;
      setFiles((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      setActiveFile((current) =>
        current === name ? (REQUIRED_FILES[0] ?? "remote.tsx") : current,
      );
    },
    [setFiles],
  );

  const onTestBuild = useCallback(async () => {
    setTesting(true);
    setBuildLog(null);
    setBuildOk(null);
    try {
      const res = await testBuild({
        input: { clientPluginId: plugin.id, source: files },
      });
      const payload = res?.testBuildClientPlugin;
      if (!payload) {
        toast.error("Test build failed");
        setBuildOk(false);
        return;
      }

      setBuildLog(payload.buildLog);
      setBuildOk(payload.success);

      if (payload.success) {
        setTestedSource(JSON.stringify(files));
        toast.success("Build passed");
      } else {
        setTestedSource(null);
        toast.error("Build failed");
      }
    } catch (e: any) {
      setBuildOk(false);
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  }, [files, plugin.id, testBuild]);

  // Gated behind a passing test build
  const onPublish = useCallback(
    async (version: string) => {
      if (!isTested) {
        toast.error("Run a test build first");
        return;
      }

      setPublishError(null);
      setPublishStage("building");
      setBuilding(true);
      try {
        const created = await createVersion({
          input: {
            clientPluginVersion: {
              clientPluginId: plugin.id,
              version,
              source: files,
              manifest: parseManifestSafe(files),
            },
          },
        });
        const versionId =
          created?.createClientPluginVersion?.clientPluginVersion?.id;

        if (!versionId) {
          setPublishStage("idle");
          setPublishError("Failed to save version");
          return;
        }

        setPublishStage("uploading");
        const built = await buildVersion({ input: { versionId } });
        const payload = built?.buildClientPluginVersion;
        setBuildLog(payload?.buildLog ?? null);
        setBuildOk(payload?.success ?? false);

        if (payload?.success) {
          toast.success(`Published ${version}`);
          refetch();
          setPublishOpen(false);
          setPublishStage("idle");
          onClose();
        } else {
          // Should be unreachable
          setPublishStage("idle");
          setPublishError(
            payload?.buildLog ?? "Publish failed after passing test build",
          );
        }
      } catch (e: any) {
        setPublishStage("idle");
        setPublishError(e.message);
      } finally {
        setBuilding(false);
      }
    },
    [buildVersion, createVersion, files, isTested, onClose, plugin.id, refetch],
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="full"
        className="w-[98vw] max-w-[1600px] h-[92vh] flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>Edit {plugin.title}</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex-1 min-h-0 p-0">
          <div className="flex h-full min-h-0 border-t">
            <FileExplorer
              files={files}
              activeFile={activeFile}
              onSelectFile={setActiveFile}
              onFilesChange={setFiles}
              onDeleteFile={onDeleteFile}
              versions={versionsList}
              latestVersionId={plugin.latestVersionId}
            />

            <main className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-center justify-between gap-3 px-3 py-1.5 border-b bg-surface-primary">
                <span className="font-mono text-xs text-secondary">
                  {activeFile}
                </span>
                {savedAt && (
                  <span className="text-2xs text-secondary whitespace-nowrap">
                    Draft saved {new Date(savedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-0">
                <CodeEditor
                  filename={activeFile}
                  value={files[activeFile] ?? ""}
                  onChange={(v) =>
                    setFiles((prev) => ({ ...prev, [activeFile]: v }))
                  }
                  height="100%"
                />
              </div>

              {buildLog && buildOk === false && (
                <div className="border-t max-h-40 overflow-y-auto shrink-0">
                  <Alert
                    variant="destructive"
                    title="Build failed"
                    className="rounded-none border-0"
                  >
                    <pre className="whitespace-pre-wrap text-xs">
                      {buildLog}
                    </pre>
                  </Alert>
                </div>
              )}
            </main>
          </div>
        </DialogBody>

        <DialogFooter>
          <div className="flex items-center gap-3 mr-auto">
            {isTested ? (
              <span className="text-xs text-fill-success">
                ✓ Build passed, ready to publish
              </span>
            ) : buildOk === false ? (
              <span className="text-xs text-fill-destructive">
                Build failed, see log
              </span>
            ) : testedSource !== null ? (
              <span className="text-xs text-fill-warning">
                Edited since last build, re-test
              </span>
            ) : (
              <span className="text-xs text-secondary">Not tested yet</span>
            )}
          </div>

          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onTestBuild} isLoading={testing}>
            Test build
          </Button>
          <Button
            variant="success"
            onClick={() => {
              setPublishError(null);
              setPublishStage("idle");
              setPublishOpen(true);
            }}
            disabled={!isTested || building}
            title={
              isTested ? "Publish a new version" : "Run a test build first"
            }
          >
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>

      {publishOpen && (
        <PublishPluginModal
          latestVersion={latestBuiltVersion}
          takenVersions={versionsList.map((v) => v.version)}
          stage={publishStage}
          error={publishError}
          onPublish={onPublish}
          onClose={() => {
            setPublishOpen(false);
            setPublishStage("idle");
            setPublishError(null);
          }}
        />
      )}
    </Dialog>
  );
};
