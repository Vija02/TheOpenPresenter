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
import { FcGoogle } from "react-icons/fc";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";

export type GoogleAccountOption = {
  id: string;
  label: string;
  displayName: string | null;
};

export const GoogleAccountChooser = ({
  isOpen,
  onClose,
  accounts,
  onChoose,
  onAddAccount,
  onChanged,
}: {
  isOpen: boolean;
  onClose: () => void;
  accounts: GoogleAccountOption[];
  onChoose: (connectionId: string) => void;
  onAddAccount: () => void;
  onChanged?: () => void;
}) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const disconnectMutation = trpc.slides.googleSlidesDisconnect.useMutation();

  const handleDisconnect = useCallback(
    async (connectionId: string) => {
      try {
        await disconnectMutation.mutateAsync({ pluginId, connectionId });
      } catch (err: any) {
        pluginApi.remote.toast.error(
          err?.message ?? "Could not disconnect the Google account.",
        );
      }
      onChanged?.();
    },
    [disconnectMutation, pluginId, pluginApi, onChanged],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FcGoogle className="size-5" />
            Choose a Google account
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="group flex items-stretch gap-1 border border-stroke rounded-sm pr-3 hover:border-blue-400 hover:bg-surface-primary-hover"
              >
                <button
                  type="button"
                  onClick={() => onChoose(account.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer p-3"
                >
                  <FcGoogle className="size-10 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-medium truncate">
                      {account.label}
                    </span>
                    {account.displayName && (
                      <span className="block text-xs text-secondary truncate">
                        {account.displayName}
                      </span>
                    )}
                  </span>
                </button>

                <PopConfirm
                  title="Disconnect this Google account?"
                  description="You will need to connect it again to pick from its Drive. Slides you have already imported are unaffected."
                  okText="Disconnect"
                  onConfirm={() => handleDisconnect(account.id)}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-center shrink-0"
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending ? (
                      <LoadingInline className="size-4" />
                    ) : (
                      <FaLinkSlash className="text-red-600" />
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
              Connect another Google account
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
