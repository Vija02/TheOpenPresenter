import { ProjectCard } from "@/containers/Dashboard/ProjectCard";
import {
  ProjectFragment,
  ScreenActiveControllerFragment,
  ScreenFragment,
} from "@repo/graphql";
import { Button, DateDisplayRelative, Link } from "@repo/ui";
import { VscAdd, VscChromeClose, VscFile } from "react-icons/vsc";
import { Link as WouterLink } from "wouter";

import {
  useTickingElapsedSeconds,
  useTickingRemainingSeconds,
} from "./shared";

const QUICK_SELECT_LIMIT = 4;

export const ScreenStatusCard = ({
  orgSlug,
  screenSlug,
  screen,
  projects,
  activeController,
  updating,
  creatingTemporary,
  onAssign,
  onRelease,
  onCreateTemporaryProject,
}: {
  orgSlug: string;
  screenSlug: string;
  screen: ScreenFragment;
  projects: readonly ProjectFragment[];
  activeController: ScreenActiveControllerFragment | null;
  updating: boolean;
  creatingTemporary: boolean;
  onAssign: (projectId: string | null) => void | Promise<void>;
  onRelease: () => void;
  onCreateTemporaryProject: () => void;
}) => {
  const idleThresholdSec =
    screen.idleAfterSeconds && screen.idleAfterSeconds > 0
      ? screen.idleAfterSeconds
      : null;

  const unassignSec =
    screen.idlePolicy === "UNASSIGN" &&
    screen.unassignAfterIdleSeconds != null &&
    screen.unassignAfterIdleSeconds >= 0
      ? screen.unassignAfterIdleSeconds
      : null;

  const lastSeenAt = activeController?.screenGuestSession?.lastSeenAt ?? null;
  const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : null;
  const idleAtMs =
    lastSeenMs !== null && idleThresholdSec !== null
      ? lastSeenMs + idleThresholdSec * 1000
      : null;
  const unassignAtMs =
    lastSeenMs !== null && idleThresholdSec !== null && unassignSec !== null
      ? lastSeenMs + (idleThresholdSec + unassignSec) * 1000
      : null;
  const idleRemaining = useTickingRemainingSeconds(idleAtMs);
  const unassignRemaining = useTickingRemainingSeconds(unassignAtMs);
  const secondsSinceSeen = useTickingElapsedSeconds(lastSeenMs);
  const isIdle = idleAtMs !== null && idleRemaining === 0;

  const controlHref = `/o/${orgSlug}/screens/${screenSlug}/control`;
  const guest = activeController?.screenGuestSession;
  const guestLabel =
    guest?.displayName ??
    (guest?.kind === "ANON" ? "Anonymous guest" : "Guest");

  const current = screen.currentProject;
  const currentLabel = current
    ? current.name !== ""
      ? current.name
      : "Untitled project"
    : screen.currentProjectId
      ? "Assigned project"
      : null;

  const recentProjects = projects
    .filter((p) => !p.isTemporary)
    .slice(0, QUICK_SELECT_LIMIT);

  return (
    <div className="border border-stroke rounded p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span
            className={[
              "inline-block h-2.5 w-2.5 rounded-full shrink-0 mt-1.5",
              activeController
                ? isIdle
                  ? "bg-amber-500"
                  : "bg-green-500"
                : screen.currentProjectId
                  ? "bg-green-500"
                  : "bg-stroke",
            ].join(" ")}
            aria-hidden
          />
          <div className="min-w-0">
            {activeController ? (
              <>
                <p className="font-medium truncate">
                  Controlled by {guestLabel}
                  {isIdle && (
                    <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-800 align-middle">
                      Idle
                    </span>
                  )}
                </p>
                <p className="text-xs text-tertiary">
                  Started{" "}
                  <DateDisplayRelative
                    date={new Date(activeController.acquiredAt)}
                  />
                  {lastSeenAt &&
                    (secondsSinceSeen === 0 ? (
                      <> · just seen</>
                    ) : (
                      <>
                        {" · last seen "}
                        <DateDisplayRelative date={new Date(lastSeenAt)} />
                      </>
                    ))}
                  {!isIdle && idleAtMs !== null && (
                    <> · idle in {idleRemaining}s</>
                  )}
                  {isIdle && unassignAtMs !== null && (
                    <> · auto-unassigns in {unassignRemaining}s</>
                  )}
                </p>
              </>
            ) : screen.currentProjectId ? (
              <p className="font-medium">Controlled by your organization</p>
            ) : (
              <>
                <p className="font-medium">Idle</p>
                <p className="text-xs text-tertiary">
                  No one is currently controlling this screen.
                </p>
              </>
            )}
            {currentLabel && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-tertiary">Showing</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-stroke bg-muted/30 max-w-full">
                  <VscFile className="text-tertiary shrink-0" />
                  <span className="font-medium truncate">{currentLabel}</span>
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeController ? (
            <Button variant="outline" size="sm" onClick={onRelease}>
              <VscChromeClose />
              End guest session
            </Button>
          ) : (
            <>
              {screen.currentProjectId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAssign(null)}
                  isLoading={updating}
                >
                  <VscChromeClose />
                  Unassign
                </Button>
              )}
              <Link variant="unstyled" asChild>
                <WouterLink href={controlHref}>
                  <Button variant="default" size="sm">
                    Open control panel
                  </Button>
                </WouterLink>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-stroke pt-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs uppercase tracking-wide text-tertiary">
            Quick select
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateTemporaryProject}
            isLoading={creatingTemporary}
          >
            <VscAdd />
            New temporary project
          </Button>
        </div>
        {recentProjects.length === 0 ? (
          <p className="text-sm text-tertiary italic">
            No recent projects yet.
          </p>
        ) : (
          <div className="stack-col items-center flex-wrap gap-0">
            {recentProjects.map((project) => {
              const href = `/app/${orgSlug}/${project.slug}`;
              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  linkHref={href}
                  onLinkClick={async (e) => {
                    e.preventDefault();
                    try {
                      await onAssign(project.id);
                    } finally {
                      window.location.href = href;
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
