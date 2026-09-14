import { Button } from "@repo/ui";
import { ReactNode } from "react";
import { BsMusicNoteBeamed } from "react-icons/bs";

import { useSetlistSources } from "../../useSetlistSources";
import { setlistSourceLabel } from "./setlistTypes";
import { PlanningCenterIcon } from "./sourceIcons";

const SourceCard = ({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
}) => (
  <div className="flex-1 min-w-[220px] stack-col items-start gap-2 rounded-sm border border-stroke bg-surface-primary p-4">
    <div className="stack-row items-center gap-2">
      <span className="text-secondary shrink-0">{icon}</span>
      <p className="font-bold">{title}</p>
    </div>
    <p className="text-sm text-secondary flex-1">{description}</p>
    {action}
  </div>
);

export const SetlistSourcesEmptyState = ({
  isPublicAccess,
}: {
  isPublicAccess: boolean;
}) => {
  const { setMyWorshipListEnabled, isSaving, planningCenter } =
    useSetlistSources();

  if (isPublicAccess) {
    return (
      <div className="stack-col items-center gap-1 rounded-sm border border-dashed border-stroke py-8 px-4 text-center">
        <p className="font-bold">No setlist sources yet</p>
        <p className="text-sm text-secondary">
          Ask an organization member to set one up.
        </p>
      </div>
    );
  }

  return (
    <div className="stack-col items-stretch gap-3 rounded-sm border border-dashed border-stroke p-4">
      <div className="stack-col items-center gap-1 text-center">
        <p className="font-bold">Import setlists from your song planner</p>
        <p className="text-sm text-secondary max-w-prose">
          Pull a whole service worth of songs in at once, instead of adding them
          one by one. Pick a source to get started, you can change this later.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        {planningCenter.isConfigured && (
          <SourceCard
            icon={<PlanningCenterIcon className="size-5" />}
            title={setlistSourceLabel.planningCenter}
            description="Import the service plans your team already builds in Planning Center."
            action={
              <Button
                size="sm"
                disabled={planningCenter.isConnecting}
                onClick={planningCenter.startConnect}
                data-testid="ly-connect-pco"
              >
                {planningCenter.isConnecting
                  ? "Connecting..."
                  : "Connect Planning Center"}
              </Button>
            }
          />
        )}

        <SourceCard
          icon={<BsMusicNoteBeamed className="size-5" />}
          title={setlistSourceLabel.myworshiplist}
          description="A free public catalogue of worship songs and setlists. Nothing to sign in to."
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={isSaving}
              onClick={() => setMyWorshipListEnabled(true)}
              data-testid="ly-enable-mwl"
            >
              {isSaving ? "Enabling..." : "Use MyWorshipList"}
            </Button>
          }
        />
      </div>

      {planningCenter.connectError && (
        <p className="text-sm text-red-600">{planningCenter.connectError}</p>
      )}
    </div>
  );
};
