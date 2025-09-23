import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  useOrganizationCloudIndexPageQuery,
  useSelectTargetOrganizationCloudConnectionMutation,
  useSyncCloudConnectionMutation,
} from "@repo/graphql";
import { extractError, globalState } from "@repo/lib";
import { Alert, Button } from "@repo/ui";
import { EventSourcePlus } from "event-source-plus";
import { useCallback, useState } from "react";
import { CombinedError } from "urql";

import "./index.css";

const OrganizationCloudPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationCloudIndexPageQuery({ variables: { slug } });
  const { data } = query[0];
  const [error, setError] = useState<Error | CombinedError | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [, syncCloudConnection] = useSyncCloudConnectionMutation();
  const [, selectTargetOrganizationCloudConnection] =
    useSelectTargetOrganizationCloudConnectionMutation();

  const cloudConnection = data?.organizationBySlug?.cloudConnections.nodes?.[0];

  const onConnect = useCallback(() => {
    setIsConnecting(true);
    setError(null);

    const eventSource = new EventSourcePlus(
      `/cloud/connect?organizationId=${data?.organizationBySlug?.id}&remote=https://theopenpresenter.com`,
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
  }, [publish, data?.organizationBySlug?.id]);

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
      setIsSyncing(true);
      setError(null);
      try {
        await syncCloudConnection({ cloudConnectionId: cloudConnection.id });
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [cloudConnection, syncCloudConnection]);
  const onForceSync = useCallback(async () => {
    if (cloudConnection) {
      setIsSyncing(true);
      setError(null);
      try {
        await syncCloudConnection({
          cloudConnectionId: cloudConnection.id,
          forceResync: true,
        });
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [cloudConnection, syncCloudConnection]);

  return (
    <SharedOrgLayout title="Cloud" sharedOrgQuery={query}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Cloud Sync</h1>
          <p className="text-gray-600">
            Connect and sync your organization with the cloud
          </p>
        </div>

        {error && (
          <Alert variant="destructive" title="Error" className="mb-4">
            {extractError(error).message}
          </Alert>
        )}

        <div className="space-y-6">
          {/* Step 1: Connect to Cloud */}
          <div className="border-b border-gray-200 pb-4">
            <div className="flex items-center mb-3">
              <span className="text-sm font-medium text-gray-500 mr-3">1.</span>
              <h2 className="text-lg font-medium">Connect to Cloud</h2>
              {cloudConnection && (
                <span className="ml-2 text-green-600">✓</span>
              )}
            </div>

            {!cloudConnection ? (
              <Button
                onClick={onConnect}
                disabled={isConnecting}
                variant="outline"
              >
                {isConnecting ? "Connecting..." : "Connect to Cloud"}
              </Button>
            ) : (
              <p className="text-sm text-gray-600">
                Successfully connected to cloud
              </p>
            )}
          </div>

          {/* Step 2: Select Organization */}
          {cloudConnection && (
            <div className="border-b border-gray-200 pb-4">
              <div className="flex items-center mb-3">
                <span className="text-sm font-medium text-gray-500 mr-3">
                  2.
                </span>
                <h2 className="text-lg font-medium">Select Organization</h2>
                {cloudConnection.targetOrganizationSlug && (
                  <span className="ml-2 text-green-600">✓</span>
                )}
              </div>

              {!cloudConnection.targetOrganizationSlug ? (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Available organizations:
                  </p>
                  <div className="space-y-2">
                    {cloudConnection.organizationList.map(
                      (orgSlug) =>
                        orgSlug && (
                          <button
                            key={orgSlug}
                            onClick={() => onSelectOrganization(orgSlug)}
                            className="block text-left p-3 border border-gray-200 hover:border-gray-300 w-full"
                          >
                            <div className="font-medium">{orgSlug}</div>
                          </button>
                        ),
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
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

              <Button onClick={onSync} disabled={isSyncing} variant="outline">
                {isSyncing ? "Syncing..." : "Start Sync"}
              </Button>
              <Button
                onClick={onForceSync}
                disabled={isSyncing}
                variant="outline"
              >
                {isSyncing ? "Syncing..." : "Force Resync"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </SharedOrgLayout>
  );
};

export default OrganizationCloudPage;
