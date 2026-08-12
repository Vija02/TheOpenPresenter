import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LoadingInline,
  PopConfirm,
} from "@repo/ui";
import { useCallback } from "react";
import { FaLinkSlash, FaPlus } from "react-icons/fa6";
import { SiCanva } from "react-icons/si";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";

export type CanvaConnectionOption = {
  id: string;
  label: string;
  connectedByName: string | null;
};

export const CanvaAccountChooser = ({
  isOpen,
  onClose,
  connections,
  onChoose,
  onAddAccount,
  onChanged,
}: {
  isOpen: boolean;
  onClose: () => void;
  connections: CanvaConnectionOption[];
  onChoose: (connectionId: string) => void;
  onAddAccount: () => void;
  onChanged?: () => void;
}) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const disconnectMutation = trpc.slides.canvaDisconnect.useMutation();

  const handleDisconnect = useCallback(
    async (connectionId: string) => {
      await disconnectMutation.mutateAsync({ pluginId, connectionId });
      onChanged?.();
    },
    [disconnectMutation, pluginId, onChanged],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SiCanva className="size-5 text-[#00C4CC]" />
            Choose a Canva account
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-2">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="group flex items-stretch gap-1 border border-stroke rounded-sm pr-3 hover:border-blue-400 hover:bg-surface-primary-hover"
              >
                <button
                  type="button"
                  onClick={() => onChoose(connection.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer p-3"
                >
                  <SiCanva className="size-6 shrink-0 text-[#00C4CC]" />
                  <span className="min-w-0">
                    <span className="block font-medium truncate">
                      {connection.label}
                    </span>
                    {connection.connectedByName && (
                      <span className="block text-xs text-secondary truncate">
                        Added by {connection.connectedByName}
                      </span>
                    )}
                  </span>
                </button>

                <PopConfirm
                  title="Disconnect this Canva account?"
                  description="Everyone in this organization will lose access to its designs until it is connected again. Slides you have already imported are unaffected."
                  okText="Disconnect"
                  onConfirm={() => handleDisconnect(connection.id)}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="self-center shrink-0"
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending ? (
                      <LoadingInline className="size-3" />
                    ) : (
                      <FaLinkSlash />
                    )}
                    Disconnect
                  </Button>
                </PopConfirm>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="justify-center"
              onClick={onAddAccount}
            >
              <FaPlus />
              Connect another Canva account
            </Button>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
