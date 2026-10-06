import { Button, OverlayToggle, PopConfirm } from "@repo/ui";
import { VscAdd, VscDebugDisconnect } from "react-icons/vsc";

import ChurchSuiteConnectModal from "../ChurchSuiteConnectModal";
import { useChurchSuite } from "../useChurchSuite";

export const ChurchSuiteConnect = ({
  churchSuite,
}: {
  churchSuite: ReturnType<typeof useChurchSuite>;
}) => {
  const { connection } = churchSuite;

  if (!connection) {
    return (
      <div>
        <OverlayToggle
          toggler={({ onToggle }) => (
            <Button
              size="sm"
              onClick={onToggle}
              data-testid="ly-cs-open-connect"
            >
              <VscAdd />
              Connect an account
            </Button>
          )}
        >
          <ChurchSuiteConnectModal />
        </OverlayToggle>
      </div>
    );
  }

  return (
    <>
      <div className="stack-col items-stretch gap-1">
        <p className="text-xs font-bold uppercase tracking-wide text-secondary">
          Connected account
        </p>
        <div data-testid="ly-cs-connection" className="min-w-0 py-2">
          <p className="truncate font-medium">{connection.label}</p>
          {connection.connectedByName && (
            <p className="text-xs text-secondary truncate">
              Connected by {connection.connectedByName}
            </p>
          )}
        </div>
      </div>

      <div>
        <PopConfirm
          title="Disconnect ChurchSuite?"
          onConfirm={churchSuite.disconnect}
          okText="Yes"
          cancelText="No"
        >
          <Button
            size="sm"
            variant="outline"
            disabled={churchSuite.isDisconnecting}
            data-testid="ly-cs-disconnect"
          >
            <VscDebugDisconnect />
            Disconnect
          </Button>
        </PopConfirm>
      </div>
    </>
  );
};
