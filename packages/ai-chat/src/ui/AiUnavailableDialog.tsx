import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";

import { type AiStatus, describeAiStatus, openAiStatusAction } from "../status";
import { AiUpgradeIcon } from "./AiUpgradeIcon";

const TITLES: Record<Exclude<AiStatus["state"], "available">, string> = {
  connect: "Connect to use AI",
  reconnect: "Reconnect to use AI",
  offline: "You're offline",
  upgrade: "Upgrade to use AI",
};

/** What a user is told on choosing an AI feature they can't use yet. */
export const AiUnavailableDialog = ({
  status,
  open,
  onOpenChange,
}: {
  status: AiStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const view = status && describeAiStatus(status);
  if (!status || status.state === "available" || !view) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="stack-row gap-2">
            <AiUpgradeIcon />
            {TITLES[status.state]}
          </DialogTitle>
          <DialogDescription>{view.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {view.action ? "Not now" : "Close"}
          </Button>
          {view.action && (
            <Button
              onClick={() => {
                onOpenChange(false);
                openAiStatusAction(view.action!.url);
              }}
            >
              {view.action.label}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
