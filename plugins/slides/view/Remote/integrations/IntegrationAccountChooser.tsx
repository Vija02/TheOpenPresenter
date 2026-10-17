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
import { ReactNode, useState } from "react";
import { FaArrowUpRightFromSquare, FaLinkSlash, FaPlus } from "react-icons/fa6";

export type IntegrationAccount = {
  id: string;
  label: string;
  sublabel?: string | null;
};

export const IntegrationAccountChooser = ({
  isOpen,
  onClose,
  name,
  icon,
  accounts,
  onChoose,
  connect,
  onImportOnce,
  disconnect,
}: {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  icon: (className: string) => ReactNode;
  accounts: IntegrationAccount[];
  onChoose: (accountId: string) => void;
  connect: { description: string; onClick: () => void };
  onImportOnce: () => void;
  disconnect: {
    description: string;
    onConfirm: (accountId: string) => Promise<void>;
  };
}) => {
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const handleDisconnect = async (accountId: string) => {
    setDisconnectingId(accountId);
    try {
      await disconnect.onConfirm(accountId);
    } finally {
      setDisconnectingId(null);
    }
  };

  const hasAccounts = accounts.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon("size-5")}
            {hasAccounts ? `Choose a ${name} account` : `Import from ${name}`}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-stretch gap-1 border border-stroke rounded-sm pr-3 hover:border-blue-400 hover:bg-surface-primary-hover"
              >
                <button
                  type="button"
                  onClick={() => onChoose(account.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer p-3"
                >
                  <span className="shrink-0">{icon("size-10")}</span>
                  <span className="min-w-0">
                    <span className="block font-medium truncate">
                      {account.label}
                    </span>
                    {account.sublabel && (
                      <span className="block text-xs text-secondary truncate">
                        {account.sublabel}
                      </span>
                    )}
                  </span>
                </button>

                <PopConfirm
                  title={`Disconnect this ${name} account?`}
                  description={disconnect.description}
                  okText="Disconnect"
                  onConfirm={() => handleDisconnect(account.id)}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-center shrink-0"
                    disabled={disconnectingId !== null}
                  >
                    {disconnectingId === account.id ? (
                      <LoadingInline className="size-4" />
                    ) : (
                      <FaLinkSlash className="text-red-600" />
                    )}
                    Disconnect
                  </Button>
                </PopConfirm>
              </div>
            ))}

            {hasAccounts && <hr className="my-2 border-stroke" />}

            <ChooserOption
              icon={<FaPlus className="size-4" />}
              title={
                hasAccounts
                  ? `Connect another ${name} account`
                  : `Connect a ${name} account`
              }
              description={connect.description}
              onClick={connect.onClick}
            />
            <ChooserOption
              icon={<FaArrowUpRightFromSquare className="size-4" />}
              title="Import once"
              description="Sign in for this import only. Nothing is saved, and it won't stay in sync."
              onClick={onImportOnce}
            />
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

const ChooserOption = ({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-start gap-3 text-left cursor-pointer border border-stroke rounded-sm p-3 hover:border-blue-400 hover:bg-surface-primary-hover"
  >
    <span className="mt-0.5 shrink-0 text-secondary">{icon}</span>
    <span className="min-w-0">
      <span className="block font-medium">{title}</span>
      <span className="block text-xs text-secondary">{description}</span>
    </span>
  </button>
);
