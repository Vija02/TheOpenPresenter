import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  PasswordInput,
  useOverlayToggle,
} from "@repo/ui";
import { FormEvent, useState } from "react";

import { ChurchSuiteIcon } from "../RemoteAddSongModal/MainView/sourceIcons";
import { useChurchSuite } from "../useChurchSuite";

const SETUP_STEPS = [
  "In ChurchSuite, add a new user for TheOpenPresenter and give it access to the Planning module.",
  'Open that user and choose "Enable API access" from the More menu.',
  "Log out, then log back in as the new user. Only they can create its secret.",
  'Open "My profile" and go to the Secrets tab. Copy the identifier shown at the top, then add a secret and copy it too.',
  "Paste both below.",
];

/** Walks an admin through creating an API user, then checks its credentials */
const ChurchSuiteConnectModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const churchSuite = useChurchSuite();

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    churchSuite
      .connect({ clientId, clientSecret })
      .then(() => onToggle?.())
      .catch(() => {});
  };

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>
            <span className="stack-row items-center gap-2">
              <ChurchSuiteIcon className="size-5" />
              Connect ChurchSuite
            </span>
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="pb-4">
          <form className="stack-col items-stretch gap-4" onSubmit={onSubmit}>
            <div className="stack-col items-stretch gap-2">
              <p className="text-sm text-secondary">
                ChurchSuite connects through a dedicated API user. Setting one
                up takes a few minutes and needs a ChurchSuite administrator.
              </p>
              <ol className="list-decimal pl-5 text-sm space-y-1">
                {SETUP_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="stack-col items-stretch gap-1">
              <Label htmlFor="ly-cs-client-id">Identifier</Label>
              <Input
                id="ly-cs-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                autoComplete="off"
                data-testid="ly-cs-client-id"
              />
            </div>

            <div className="stack-col items-stretch gap-1">
              <Label htmlFor="ly-cs-client-secret">Secret</Label>
              <PasswordInput
                id="ly-cs-client-secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="off"
                data-testid="ly-cs-client-secret"
              />
            </div>

            {churchSuite.connectError && (
              <p className="text-sm text-red-600">{churchSuite.connectError}</p>
            )}

            <div className="stack-row justify-end gap-2">
              <Button type="button" variant="outline" onClick={onToggle}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  churchSuite.isConnecting ||
                  !clientId.trim() ||
                  !clientSecret.trim()
                }
                data-testid="ly-cs-connect"
              >
                {churchSuite.isConnecting ? "Checking..." : "Connect"}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default ChurchSuiteConnectModal;
