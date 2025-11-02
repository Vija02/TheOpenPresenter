import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  useDeleteCloudConnectionMutation,
  useOrganizationCloudIndexPageQuery,
  useSelectTargetOrganizationCloudConnectionMutation,
  useSyncCloudConnectionMutation,
} from "@repo/graphql";
import { extractError, globalState } from "@repo/lib";
import { Alert, Button, Input, Option } from "@repo/ui";
import { addDays } from "date-fns";
import { EventSourcePlus } from "event-source-plus";
import { useCallback, useState } from "react";
import { GoUnlink } from "react-icons/go";
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

const OrganizationCloudPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationCloudIndexPageQuery({ variables: { slug } });
  const { data } = query[0];
  const [error, setError] = useState<Error | CombinedError | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

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

  const onConnect = useCallback(() => {
    setIsConnecting(true);
    setError(null);

    const host = hostInput.trim() ?? "theopenpresenter.com";
    const remoteUrl = host.startsWith("http") ? host : `https://${host}`;

    const eventSource = new EventSourcePlus(
      `/cloud/connect?organizationId=${data?.organizationBySlug?.id}&remote=${remoteUrl}`,
      {
        retryStrategy: "on-error",
      },
    );
    let popup: WindowProxy | null;
    const controller = eventSource.listen({
      onMessage(ev) {
        try {
          const data = JSON.parse(ev.data);

          if (data.authLink) {
            // TODO: Make this work in tauri: https://tauri.app/plugin/opener/
            popup = window.open(data.authLink, "popup", "popup=true");
          }
          if (data.error) {
            controller.abort();
            setError(new Error(data.error));
            setIsConnecting(false);
          }
          if (data.done) {
            publish();
            setIsConnecting(false);
          }
        } catch (e) {
          // Keep alive
        }
      },
      onRequestError(ctx) {
        setError(ctx.error);
        setIsConnecting(false);
        popup?.close();
      },
      onResponseError(ctx) {
        setError(ctx.error ?? new Error("Unknown error occurred"));
        setIsConnecting(false);
        popup?.close();
      },
    });
  }, [publish, data?.organizationBySlug?.id, hostInput]);

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
      } catch (err) {
        setError(err as Error);
      }
    }
  }, [cloudConnection, syncCloudConnection]);
  const onForceSync = useCallback(async () => {
    if (cloudConnection) {
      setError(null);
      try {
        await syncCloudConnection({
          cloudConnectionId: cloudConnection.id,
          forceResync: true,
        });
      } catch (err) {
        setError(err as Error);
      }
    }
  }, [cloudConnection, syncCloudConnection]);

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

          <Alert variant="warning" title="Experimental">
            This feature is highly experimental. Some things might not be
            obvious and might be broken.
          </Alert>
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
                <Button
                  onClick={onConnect}
                  disabled={!hostInput.trim()}
                  isLoading={isConnecting}
                  variant="outline"
                >
                  {isConnecting ? "Connecting..." : "Connect to Cloud"}
                </Button>
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
                            data-testid={`select-org-${orgSlug}`}
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

              <div className="stack-row">
                <Button
                  onClick={onSync}
                  isLoading={isSyncFetching}
                  variant="outline"
                >
                  {isSyncFetching ? "Syncing..." : "Start Sync"}
                </Button>
                <Button
                  onClick={onForceSync}
                  isLoading={isSyncFetching}
                  variant="outline"
                >
                  {isSyncFetching ? "Syncing..." : "Force Resync"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </SharedOrgLayout>
  );
};

export default OrganizationCloudPage;
