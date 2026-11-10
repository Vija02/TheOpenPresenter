import { Button } from "@repo/ui";

import { type AiStatus, describeAiStatus, openAiStatusAction } from "../status";
import { AiUpgradeIcon } from "./AiUpgradeIcon";

/** Why AI can't be used here, with the way to fix it when there is one. */
export const AiUnavailable = ({
  status,
  className,
}: {
  status: AiStatus;
  className?: string;
}) => {
  const view = describeAiStatus(status);
  if (!view) return null;

  return (
    <div
      className={`stack-row justify-between gap-2 flex-wrap rounded border border-stroke bg-surface-secondary px-2 py-1.5 text-xs ${className ?? ""}`}
      data-testid="ai-unavailable"
    >
      <span className="stack-row gap-1.5 text-secondary">
        <AiUpgradeIcon />
        {view.message}
      </span>
      {view.action && (
        <Button
          size="xs"
          variant="outline"
          onClick={() => openAiStatusAction(view.action!.url)}
        >
          {view.action.label}
        </Button>
      )}
    </div>
  );
};
