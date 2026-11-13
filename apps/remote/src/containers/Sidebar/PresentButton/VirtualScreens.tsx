import { MAIN_OUTPUT_ID } from "@repo/layout";
import { usePluginMetaData } from "@repo/shared";
import { Link } from "@repo/ui";
import { cx } from "class-variance-authority";
import { useState } from "react";
import {
  MdCheckCircle,
  MdMonitor,
  MdOutlineCancelPresentation,
  MdSettings,
} from "react-icons/md";
import { useSearch } from "wouter";

import { useVirtualScreens } from "./useVirtualScreens";

const SCREEN_LIMIT = 5;

export const VirtualScreens = ({ outputId }: { outputId: string }) => {
  const { orgSlug, projectId } = usePluginMetaData();
  const search = useSearch();
  const appendSearch = (href: string) => (search ? `${href}?${search}` : href);
  const [showAll, setShowAll] = useState(false);
  const {
    screens,
    unavailable,
    loading,
    fetching,
    assigning,
    present: handlePresent,
    unassign: handleUnassign,
  } = useVirtualScreens();

  if (unavailable) return null;
  const sorted = [...screens].sort(
    (a, b) =>
      (a.currentProjectId === projectId ? 0 : 1) -
      (b.currentProjectId === projectId ? 0 : 1),
  );
  const visible = showAll ? sorted : sorted.slice(0, SCREEN_LIMIT);
  const hiddenCount = sorted.length - visible.length;

  return (
    <div className="flex flex-col">
      {outputId !== MAIN_OUTPUT_ID && screens.length > 0 && (
        <p className="px-3 pb-1 text-xs text-tertiary">
          Virtual screens always show the main view.
        </p>
      )}
      {loading && (
        <p className="px-3 py-2 text-sm text-tertiary">
          Loading virtual screens…
        </p>
      )}
      {!fetching && screens.length === 0 && (
        <div className="px-3 py-2 text-sm text-tertiary">
          <p className="mb-1">No virtual screens set up yet.</p>
          <Link href={appendSearch(`/o/${orgSlug}/screens`)} isExternal>
            Set up a virtual screen
          </Link>
        </div>
      )}
      {visible.map((screen) => {
        const isShowingThisProject = screen.currentProjectId === projectId;
        return (
          <div
            key={screen.id}
            className={cx([
              "group flex items-stretch rounded transition-colors hover:bg-surface-primary-hover",
              isShowingThisProject && "bg-surface-primary-hover",
            ])}
          >
            <button
              type="button"
              disabled={assigning || isShowingThisProject}
              onClick={() => handlePresent(screen.id, screen.name)}
              className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left text-sm cursor-pointer focus:outline-none disabled:cursor-default"
            >
              <span
                className={cx([
                  "mt-0.5 shrink-0",
                  isShowingThisProject && "text-success",
                ])}
              >
                {isShowingThisProject ? <MdCheckCircle /> : <MdMonitor />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{screen.name}</span>
                <span className="block text-xs text-tertiary">
                  {isShowingThisProject
                    ? "Presenting here"
                    : screen.currentProject
                      ? `Showing: ${screen.currentProject.name || "Untitled"}`
                      : "Idle"}
                </span>
              </span>
            </button>

            <Link
              href={appendSearch(`/o/${orgSlug}/screens/${screen.slug}/admin`)}
              isExternal
              variant="unstyled"
              className="flex w-9 shrink-0 items-center justify-center self-stretch rounded text-tertiary opacity-0 transition-opacity hover:text-secondary focus-visible:opacity-100 group-hover:opacity-100"
              title="Virtual screen settings"
              aria-label="Virtual screen settings"
            >
              <MdSettings />
            </Link>

            {isShowingThisProject && (
              <button
                type="button"
                disabled={assigning}
                onClick={() => handleUnassign(screen.id, screen.name)}
                className="flex w-9 shrink-0 items-center justify-center self-stretch rounded text-tertiary cursor-pointer transition-colors hover:text-secondary disabled:cursor-not-allowed disabled:opacity-60"
                title="Stop presenting to this virtual screen"
                aria-label="Stop presenting to this virtual screen"
              >
                <MdOutlineCancelPresentation />
              </button>
            )}
          </div>
        );
      })}
      {!fetching && screens.length > SCREEN_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full rounded px-3 py-2 text-left text-xs font-medium text-secondary cursor-pointer transition-colors hover:bg-surface-primary-hover focus:outline-none"
        >
          {showAll ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
};
