import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  LoadingInline,
  PopConfirm,
  useOverlayToggle,
} from "@repo/ui";
import { ReactNode } from "react";
import { BsMusicNoteBeamed } from "react-icons/bs";
import { VscAdd, VscCheck, VscDebugDisconnect } from "react-icons/vsc";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { setlistSourceLabel } from "../RemoteAddSongModal/MainView/setlistTypes";
import { PlanningCenterIcon } from "../RemoteAddSongModal/MainView/sourceIcons";
import { useSetlistSources } from "../useSetlistSources";

const SourceSection = ({
  icon,
  title,
  description,
  isEnabled,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  isEnabled: boolean;
  children: ReactNode;
}) => (
  <div className="stack-col items-stretch gap-3 rounded-sm border border-stroke p-4">
    <div className="stack-row items-start justify-between gap-3">
      <div className="stack-row items-center gap-2 min-w-0">
        <span className="text-secondary shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="font-bold">{title}</p>
          <p className="text-sm text-secondary">{description}</p>
        </div>
      </div>

      {isEnabled && (
        <span className="stack-row items-center gap-1 shrink-0 text-xs text-secondary border border-stroke rounded-full px-2 py-0.5">
          <VscCheck />
          On
        </span>
      )}
    </div>

    {children}
  </div>
);

const SetlistSourcesModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const {
    isLoading,
    isMyWorshipListEnabled,
    setMyWorshipListEnabled,
    isSaving,
    planningCenter,
  } = useSetlistSources();

  // Only one Planning Center account is supported per organization.
  const connection = planningCenter.connections[0] ?? null;

  const disconnectMutation =
    trpc.lyricsPresenter.planningCenter.disconnect.useMutation({
      onSuccess: () => void planningCenter.refetchStatus(),
      onError: (err) =>
        pluginApi.remote.toast.error(
          err.message || "Could not disconnect that account",
        ),
    });

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>Setlist sources</DialogTitle>
        </DialogHeader>

        <DialogBody className="stack-col items-stretch gap-3 pb-4">
          <p className="text-sm text-secondary">
            Where setlists can be imported from. Turn on as many as you need.
          </p>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <LoadingInline />
            </div>
          ) : (
            <>
              {/* Planning Center */}
              <SourceSection
                icon={<PlanningCenterIcon className="size-5" />}
                title={setlistSourceLabel.planningCenter}
                description="Import the service plans your team already builds in Planning Center."
                isEnabled={!!connection}
              >
                {!planningCenter.isConfigured ? (
                  <p className="text-sm text-secondary">
                    Planning Center is not set up on this server.
                  </p>
                ) : (
                  <>
                    {connection && (
                      <div className="stack-col items-stretch gap-1">
                        <p className="text-xs font-bold uppercase tracking-wide text-secondary">
                          Connected account
                        </p>
                        <div
                          data-testid="ly-pco-connection"
                          className="stack-row items-center gap-2 min-w-0 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {connection.label}
                            </p>
                            {connection.connectedByName && (
                              <p className="text-xs text-secondary truncate">
                                Connected by {connection.connectedByName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {planningCenter.connectError && (
                      <p className="text-sm text-red-600">
                        {planningCenter.connectError}
                      </p>
                    )}

                    <div>
                      {connection ? (
                        <PopConfirm
                          title="Disconnect this Planning Center account?"
                          onConfirm={() =>
                            disconnectMutation.mutate({
                              pluginId,
                              connectionId: connection.id,
                            })
                          }
                          okText="Yes"
                          cancelText="No"
                          key="disconnect"
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disconnectMutation.isPending}
                            data-testid="ly-pco-disconnect"
                          >
                            <VscDebugDisconnect />
                            Disconnect
                          </Button>
                        </PopConfirm>
                      ) : (
                        <Button
                          size="sm"
                          onClick={planningCenter.startConnect}
                          disabled={planningCenter.isConnecting}
                          data-testid="ly-pco-connect"
                        >
                          <VscAdd />
                          {planningCenter.isConnecting
                            ? "Connecting..."
                            : "Connect an account"}
                        </Button>
                      )}
                    </div>

                    {planningCenter.isConnecting && (
                      <p className="text-xs text-secondary">
                        A Planning Center window has opened. Finish signing in
                        there, then come back.
                      </p>
                    )}
                  </>
                )}
              </SourceSection>

              {/* MyWorshipList */}
              <SourceSection
                icon={<BsMusicNoteBeamed className="size-5" />}
                title={setlistSourceLabel.myworshiplist}
                description="A free public catalogue of worship songs and setlists. Nothing to sign in to."
                isEnabled={isMyWorshipListEnabled}
              >
                <div>
                  <Button
                    size="sm"
                    variant={isMyWorshipListEnabled ? "outline" : "default"}
                    disabled={isSaving}
                    onClick={() =>
                      setMyWorshipListEnabled(!isMyWorshipListEnabled)
                    }
                    data-testid="ly-mwl-toggle"
                  >
                    {isMyWorshipListEnabled ? "Turn off" : "Turn on"}
                  </Button>
                </div>
              </SourceSection>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default SetlistSourcesModal;
