import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  useDeleteCloudConnectionMutation,
  useOrganizationCloudIndexPageQuery,
  useSelectTargetOrganizationCloudConnectionMutation,
  useSyncCloudConnectionMutation,
} from "@repo/graphql";
import { extractError, globalState } from "@repo/lib";
import {
  Alert,
  Button,
  Input,
  Option,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useDisclosure,
} from "@repo/ui";
import { EventSourcePlus } from "event-source-plus";
import { useCallback, useEffect, useRef, useState } from "react";
import { GoUnlink } from "react-icons/go";
import { IoChevronDown } from "react-icons/io5";
import { CombinedError } from "urql";

import "./index.css";

const SessionExpiryStatus = ({
  sessionCookieExpiry,
}: {
  sessionCookieExpiry: string;
}) => {
  const expiryDate = new Date(sessionCookieExpiry);
  const now = new Date();
  const isExpired = expiryDate <= now;
  const msUntilExpiry = expiryDate.getTime() - now.getTime();
  const daysUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24));
  const isExpiringSoon = !isExpired && daysUntilExpiry <= 3;

  let statusColor = "text-primary";
  let statusText = "Session Expires at";

  if (isExpired) {
    statusColor = "text-red-600";
    statusText = "Session Expired at";
  } else if (isExpiringSoon) {
    statusColor = "text-orange-700";
    statusText = "Session Expires Soon";
  }

  return (
    <div className="text-right">
      <p className={`text-sm font-medium ${statusColor}`}>{statusText}</p>
      <p className={`text-sm ${statusColor}`}>{expiryDate.toLocaleString()}</p>
    </div>
  );
};

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  PENDING: { dot: "bg-gray-400", label: "Pending" },
  SYNCING: { dot: "bg-blue-500 animate-pulse", label: "Syncing" },
  IN_PROGRESS: { dot: "bg-blue-500 animate-pulse", label: "In progress" },
  SYNCED: { dot: "bg-green-500", label: "Synced" },
  COMPLETED: { dot: "bg-green-500", label: "Completed" },
  FAILED: { dot: "bg-red-500", label: "Failed" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const style = STATUS_STYLES[status] ?? {
    dot: "bg-gray-400",
    label: status,
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
};

type SyncRun = {
  id: string;
  status: string;
  forceResync: boolean;
  totalProjects: number;
  projectsToSync: number;
  syncedProjects: number;
  addedProjects: number;
  updatedProjects: number;
  failedProjects: number;
  projectsToDelete: number;
  deletedProjects: number;
  mediaStatus: string;
  totalMedia: number;
  syncedMedia: number;
  // bigint fields arrive as strings over GraphQL
  totalBytes: number | string;
  downloadedBytes: number | string;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
};

const formatBytes = (bytes: number) => {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const PROJECT_TERMINAL = new Set(["COMPLETED", "FAILED"]);
const MEDIA_TERMINAL = new Set(["SYNCED", "FAILED"]);

type SyncPhase = "projects" | "media" | "done";

type SyncRunState = {
  status: string;
  mediaStatus: string;
  isActive: boolean;
  isTerminal: boolean;
  phase: SyncPhase;
};

const getRunState = (run: {
  status: string;
  mediaStatus: string;
}): SyncRunState => {
  const status = String(run.status);
  const mediaStatus = String(run.mediaStatus);

  const projectFailed = status === "FAILED";
  const projectDone = status === "COMPLETED";
  const mediaTerminal = MEDIA_TERMINAL.has(mediaStatus);

  const isActive =
    !PROJECT_TERMINAL.has(status) || (projectDone && !mediaTerminal);

  const phase: SyncPhase = projectFailed
    ? "done"
    : !projectDone
      ? "projects"
      : mediaTerminal
        ? "done"
        : "media";

  return {
    status,
    mediaStatus,
    isActive,
    isTerminal: !isActive,
    phase,
  };
};

const SyncProgress = ({ run }: { run: SyncRun }) => {
  const status = String(run.status);
  const total = run.totalProjects;
  const toSync = run.projectsToSync;
  const synced = run.syncedProjects;
  const failed = run.failedProjects;
  const toDelete = run.projectsToDelete;
  const deleted = run.deletedProjects;
  const added = run.addedProjects ?? 0;
  const updated = run.updatedProjects ?? 0;
  // Projects that already existed locally and were up to date (nothing to do).
  const alreadyUpToDate = Math.max(0, total - toSync);
  const hasChanges = added > 0 || updated > 0 || deleted > 0 || failed > 0;
  const syncPercent = toSync > 0 ? Math.round((synced / toSync) * 100) : 100;
  const syncBarColor =
    status === "FAILED"
      ? "bg-red-500"
      : synced >= toSync
        ? "bg-green-500"
        : "bg-blue-500";

  const mediaStatus = String(run.mediaStatus);
  const mediaTotal = run.totalMedia ?? 0;
  const mediaSynced = run.syncedMedia ?? 0;
  const mediaBytesTotal = Number(run.totalBytes ?? 0);
  const mediaBytesDownloaded = Number(run.downloadedBytes ?? 0);
  // Prefer byte-based progress (reflects "how much is left"); fall back to
  // file counts when byte totals aren't known.
  const mediaPercent =
    mediaBytesTotal > 0
      ? Math.min(
          100,
          Math.round((mediaBytesDownloaded / mediaBytesTotal) * 100),
        )
      : mediaTotal > 0
        ? Math.round((mediaSynced / mediaTotal) * 100)
        : 0;
  const mediaBarColor =
    mediaStatus === "FAILED"
      ? "bg-red-500"
      : mediaStatus === "SYNCED"
        ? "bg-green-500"
        : "bg-blue-500";

  return (
    <div className="mt-4 rounded-lg border border-stroke p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium">Latest sync</span>
        {run.forceResync && (
          <span className="text-xs text-tertiary">(force resync)</span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-secondary">
          Projects <span className="text-tertiary">({total} total)</span>
        </span>
        <StatusBadge status={status} />
      </div>
      {toSync > 0 && (
        <div className="mt-1">
          <div className="mb-1 flex items-center justify-between text-xs text-secondary">
            <span>Syncing</span>
            <span>
              {synced} / {toSync}
              {failed > 0 && (
                <span className="text-red-600"> · {failed} failed</span>
              )}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-fill-muted-disabled">
            <div
              className={`h-full rounded-full transition-all ${syncBarColor}`}
              style={{ width: `${syncPercent}%` }}
            />
          </div>
        </div>
      )}
      {toSync === 0 && failed > 0 && (
        <div className="mt-1 text-xs text-red-600">{failed} failed</div>
      )}
      {toDelete > 0 && (
        <div className="mt-1 flex items-center justify-between text-xs text-secondary">
          <span>Deleting</span>
          <span>
            {deleted} / {toDelete}
          </span>
        </div>
      )}

      {/* Explicit sentence of what happened to projects this run */}
      <div className="mt-2 text-xs text-secondary">
        {total} {total === 1 ? "project" : "projects"} synced
        {hasChanges ? (
          <>
            {added > 0 && (
              <>
                ,{" "}
                <span className="font-medium text-green-600">
                  {added} added
                </span>
              </>
            )}
            {updated > 0 && (
              <>
                ,{" "}
                <span className="font-medium text-primary">
                  {updated} updated
                </span>
              </>
            )}
            {deleted > 0 && (
              <>
                ,{" "}
                <span className="font-medium text-red-600">
                  {deleted} deleted
                </span>
              </>
            )}
            {failed > 0 && (
              <>
                ,{" "}
                <span className="font-medium text-red-600">
                  {failed} failed
                </span>
              </>
            )}
          </>
        ) : (
          <>
            {" · "}
            <span className="text-tertiary">{alreadyUpToDate} unchanged</span>
          </>
        )}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-secondary">
            Media
            {mediaTotal > 0 && (
              <span className="ml-1 text-tertiary">
                {mediaBytesTotal > 0 && (
                  <>
                    {formatBytes(mediaBytesDownloaded)} /{" "}
                    {formatBytes(mediaBytesTotal)}
                    {" · "}
                  </>
                )}
                {mediaSynced} / {mediaTotal} files
              </span>
            )}
          </span>
          <StatusBadge status={mediaStatus} />
        </div>
        {mediaTotal > 0 && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-fill-muted-disabled">
            <div
              className={`h-full rounded-full transition-all ${mediaBarColor}`}
              style={{ width: `${mediaPercent}%` }}
            />
          </div>
        )}
      </div>

      {run.error && (
        <p className="mt-2 text-xs text-red-600 break-words">{run.error}</p>
      )}
    </div>
  );
};

const OrganizationCloudPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationCloudIndexPageQuery({ variables: { slug } });
  const { data } = query[0];
  const reexecuteQuery = query[1];
  const [error, setError] = useState<Error | CombinedError | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [pollActive, setPollActive] = useState(false);

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [, syncCloudConnection] = useSyncCloudConnectionMutation();
  const [
    { fetching: isSyncFetching },
    selectTargetOrganizationCloudConnection,
  ] = useSelectTargetOrganizationCloudConnectionMutation();
  const [{ fetching: isDeleteFetching }, deleteCloudConnection] =
    useDeleteCloudConnectionMutation();

  const cloudConnection = data?.organizationBySlug?.cloudConnections.nodes?.[0];
  const [hostInput, setHostInput] = useState("theopenpresenter.com");
  const connectedHost = cloudConnection?.host ?? "theopenpresenter.com";
  const [manualAuthLink, setManualAuthLink] = useState<string | null>(null);
  const connectDropdown = useDisclosure();
  const syncDropdown = useDisclosure();

  const latestRun = cloudConnection?.cloudSyncRuns?.nodes?.[0] ?? null;

  const runState = latestRun
    ? getRunState({
        status: String(latestRun.status),
        mediaStatus: String(latestRun.mediaStatus),
      })
    : null;
  const isRunActive = runState?.isActive ?? false;
  const isRunTerminal = runState?.isTerminal ?? false;

  // Poll while a sync run is active
  useEffect(() => {
    if (!pollActive && !isRunActive) return;
    const interval = setInterval(() => {
      reexecuteQuery({ requestPolicy: "network-only" });
    }, 2000);
    return () => clearInterval(interval);
  }, [pollActive, isRunActive, reexecuteQuery]);

  useEffect(() => {
    if (pollActive && isRunTerminal) {
      setPollActive(false);
    }
  }, [pollActive, isRunTerminal]);

  const connectionRef = useRef<{
    controller: AbortController;
    popup: WindowProxy | null;
  } | null>(null);

  const onConnect = useCallback(
    (manual: boolean = false) => {
      setIsConnecting(true);
      setError(null);
      setManualAuthLink(null);
      connectDropdown.onClose();

      const host = hostInput.trim() ?? "theopenpresenter.com";
      const remoteUrl = host.startsWith("http") ? host : `https://${host}`;

      const eventSource = new EventSourcePlus(
        `/cloud/connect?organizationId=${data?.organizationBySlug?.id}&remote=${remoteUrl}`,
        {
          retryStrategy: "on-error",
        },
      );
      let popup: WindowProxy | null = null;
      const controller = eventSource.listen({
        onMessage(ev) {
          try {
            const data = JSON.parse(ev.data);

            if (data.authLink) {
              if (manual) {
                setManualAuthLink(data.authLink);
              } else if (window.__TAURI__) {
                const { openUrl } = window.__TAURI__.opener;
                openUrl(data.authLink);
              } else {
                popup = window.open(data.authLink, "popup", "popup=true");
                if (connectionRef.current) {
                  connectionRef.current.popup = popup;
                }
              }
            }
            if (data.error) {
              controller.abort();
              setError(new Error(data.error));
              setIsConnecting(false);
              connectionRef.current = null;
            }
            if (data.done) {
              publish();
              setIsConnecting(false);
              setManualAuthLink(null);
              connectionRef.current = null;
            }
          } catch (e) {
            // Keep alive
          }
        },
        onRequestError(ctx) {
          setError(ctx.error);
          setIsConnecting(false);
          popup?.close();
          connectionRef.current = null;
        },
        onResponseError(ctx) {
          setError(ctx.error ?? new Error("Unknown error occurred"));
          setIsConnecting(false);
          popup?.close();
          connectionRef.current = null;
        },
      });

      connectionRef.current = { controller, popup };
    },
    [publish, data?.organizationBySlug?.id, hostInput, connectDropdown],
  );

  const onCancelConnect = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.controller.abort();
      connectionRef.current.popup?.close();
      connectionRef.current = null;
    }
    setIsConnecting(false);
    setManualAuthLink(null);
  }, []);

  const onSelectOrganization = useCallback(
    async (organizationSlug: string) => {
      await selectTargetOrganizationCloudConnection({
        cloudConnectionId: cloudConnection?.id,
        targetOrganizationSlug: organizationSlug,
      });
    },
    [cloudConnection?.id, selectTargetOrganizationCloudConnection],
  );

  const onSync = useCallback(async () => {
    if (cloudConnection) {
      setError(null);
      try {
        await syncCloudConnection({ cloudConnectionId: cloudConnection.id });
        setPollActive(true);
        reexecuteQuery({ requestPolicy: "network-only" });
      } catch (err) {
        setError(err as Error);
      }
    }
  }, [cloudConnection, syncCloudConnection, reexecuteQuery]);
  const onForceSync = useCallback(async () => {
    if (cloudConnection) {
      setError(null);
      try {
        await syncCloudConnection({
          cloudConnectionId: cloudConnection.id,
          forceResync: true,
        });
        setPollActive(true);
        reexecuteQuery({ requestPolicy: "network-only" });
      } catch (err) {
        setError(err as Error);
      }
    }
  }, [cloudConnection, syncCloudConnection, reexecuteQuery]);

  const onUnlink = useCallback(async () => {
    if (cloudConnection) {
      setError(null);
      try {
        await deleteCloudConnection({ id: cloudConnection.id });
        publish();
      } catch (err) {
        setError(err as Error);
      }
    }
  }, [cloudConnection, deleteCloudConnection, publish]);

  return (
    <SharedOrgLayout title="Cloud" sharedOrgQuery={query}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">Cloud Sync</h1>
              <p className="text-secondary">
                Connect and sync your organization with the cloud
              </p>
            </div>
            {cloudConnection?.sessionCookieExpiry && (
              <SessionExpiryStatus
                sessionCookieExpiry={cloudConnection.sessionCookieExpiry}
              />
            )}
          </div>
        </div>

        {error && (
          <Alert variant="destructive" title="Error" className="mb-4">
            {extractError(error).message}
          </Alert>
        )}

        <div className="space-y-6">
          {/* Step 1: Connect to Cloud */}
          <div className="border-b border-stroke pb-4">
            <div className="flex items-center mb-3">
              <span className="text-sm font-medium text-gray-500 mr-3">1.</span>
              <h2 className="text-lg font-medium">Connect to Cloud</h2>
              {cloudConnection && (
                <span className="ml-2 text-fill-success">✓</span>
              )}
            </div>

            {!cloudConnection ? (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="host-input"
                    className="block text-sm font-medium text-secondary mb-1"
                  >
                    Cloud Host
                  </label>
                  <Input
                    data-testid="host-input"
                    type="text"
                    value={hostInput}
                    onChange={(e) => setHostInput(e.target.value)}
                    placeholder="theopenpresenter.com"
                    disabled={isConnecting}
                    className="max-w-md"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the cloud host URL (defaults to theopenpresenter.com)
                  </p>
                </div>
                <div className="flex">
                  <Button
                    onClick={
                      isConnecting ? onCancelConnect : () => onConnect(false)
                    }
                    disabled={!hostInput.trim()}
                    isLoading={isConnecting}
                    variant="outline"
                    className="rounded-r-none border-r-0 w-36"
                  >
                    {isConnecting ? (
                      <>
                        <span className="[button:hover_&]:hidden">
                          Connecting...
                        </span>
                        <span className="hidden [button:hover_&]:inline">
                          Cancel
                        </span>
                      </>
                    ) : (
                      "Connect to Cloud"
                    )}
                  </Button>
                  <Popover
                    open={connectDropdown.open}
                    onOpenChange={connectDropdown.setOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="rounded-l-none px-2"
                        disabled={!hostInput.trim() || isConnecting}
                      >
                        <IoChevronDown />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-48 p-1"
                      hideCloseButton
                      hideArrow
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => onConnect(true)}
                      >
                        Connect manually
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
                {manualAuthLink && (
                  <Alert variant="info" title="Manual Authentication">
                    <p className="text-sm mb-2">
                      Open this link in your browser to authenticate:
                    </p>
                    <Input
                      type="text"
                      value={manualAuthLink}
                      readOnly
                      className="font-mono text-xs bg-background"
                      onClick={(e) => e.currentTarget.select()}
                    />
                  </Alert>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-tertiary">
                  Successfully connected to cloud
                </p>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Connected Host
                  </label>
                  <Input
                    type="text"
                    value={connectedHost}
                    disabled
                    className="max-w-md bg-fill-muted-disabled"
                  />
                </div>
                <div className="pt-2">
                  <Button
                    onClick={onUnlink}
                    isLoading={isDeleteFetching}
                    variant="outline"
                    size="sm"
                  >
                    <GoUnlink />
                    {isDeleteFetching ? "Unlinking..." : "Unlink"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Select Organization */}
          {cloudConnection && (
            <div className="border-b border-stroke pb-4">
              <div className="flex items-center mb-3">
                <span className="text-sm font-medium text-gray-500 mr-3">
                  2.
                </span>
                <h2 className="text-lg font-medium">Select Organization</h2>
                {cloudConnection.targetOrganizationSlug && (
                  <span className="ml-2 text-fill-success">✓</span>
                )}
              </div>

              {!cloudConnection.targetOrganizationSlug ? (
                <div>
                  <p className="text-sm text-secondary mb-3">
                    Available organizations:
                  </p>
                  <div className="space-y-2">
                    {cloudConnection.organizationList.map(
                      (orgSlug) =>
                        orgSlug && (
                          <Option
                            key={orgSlug}
                            onClick={() => onSelectOrganization(orgSlug)}
                            title={undefined}
                            description={orgSlug}
                            testId={`select-org-${orgSlug}`}
                          />
                        ),
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-secondary">
                  Selected organization:{" "}
                  <span className="font-medium">
                    {cloudConnection.targetOrganizationSlug}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Step 3: Sync */}
          {cloudConnection && cloudConnection.targetOrganizationSlug && (
            <div>
              <div className="flex items-center mb-3">
                <span className="text-sm font-medium text-gray-500 mr-3">
                  3.
                </span>
                <h2 className="text-lg font-medium">Sync Data</h2>
              </div>

              <div className="flex">
                <Button
                  onClick={onSync}
                  isLoading={isSyncFetching || isRunActive}
                  disabled={isSyncFetching || isRunActive}
                  variant="outline"
                  className="rounded-r-none border-r-0"
                >
                  {isSyncFetching || isRunActive ? "Syncing..." : "Start Sync"}
                </Button>
                <Popover
                  open={syncDropdown.open}
                  onOpenChange={syncDropdown.setOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="rounded-l-none px-2"
                      disabled={isSyncFetching || isRunActive}
                    >
                      <IoChevronDown />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-48 p-1"
                    hideCloseButton
                    hideArrow
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        syncDropdown.onClose();
                        onForceSync();
                      }}
                    >
                      Force resync
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>

              {latestRun && <SyncProgress run={latestRun as SyncRun} />}
            </div>
          )}
        </div>
      </div>
    </SharedOrgLayout>
  );
};

export default OrganizationCloudPage;
