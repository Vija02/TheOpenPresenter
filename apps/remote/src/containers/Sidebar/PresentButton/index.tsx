import {
  useOrganizationScreensIndexPageQuery,
  useSetExistingProjectToScreenMutation,
} from "@repo/graphql";
import { usePluginMetaData } from "@repo/shared";
import {
  Button,
  Link,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui";
import { cx } from "class-variance-authority";
import { lazy, useState } from "react";
import { createPortal } from "react-dom";
import {
  MdCheckCircle,
  MdCoPresent,
  MdMonitor,
  MdOpenInNew,
  MdOutlineCancelPresentation,
  MdSettings,
} from "react-icons/md";
import { toast } from "react-toastify";
import { useSearch } from "wouter";

import { useRendererSelection } from "../../../contexts/rendererSelection";
import "./index.css";

const PresentMonitorModalWrapper = lazy(() => import("./PresentMonitorModal"));

const SCREEN_LIMIT = 5;

export const PresentButton = ({ isMobile }: { isMobile?: boolean }) => {
  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();
  const { selectedRendererId } = useRendererSelection();

  if (window.__TAURI_INTERNALS__) {
    const PresentButtonElement = ({ onClick }: { onClick?: () => void }) => (
      <Button
        className={cx(["rt--present-button"])}
        variant="outline"
        size={isMobile ? "mini" : "default"}
        onClick={onClick}
      >
        <MdCoPresent />
        Present
      </Button>
    );
    const StopPresentButtonElement = ({
      onClick,
    }: {
      onClick?: () => void;
    }) => (
      <Button
        className={cx(["rt--present-button"])}
        variant="outline"
        size={isMobile ? "mini" : "default"}
        onClick={onClick}
      >
        <MdOutlineCancelPresentation />
        Stop Presenting
      </Button>
    );

    return (
      <PresentMonitorModalWrapper
        PresentButtonElement={PresentButtonElement}
        StopPresentButtonElement={StopPresentButtonElement}
      />
    );
  }

  // Build renderer URL with both existing search params and renderer ID
  const rendererParam = `renderer=${selectedRendererId}`;
  const renderHref = search
    ? `/render/${orgSlug}/${projectSlug}?${search}&${rendererParam}`
    : `/render/${orgSlug}/${projectSlug}?${rendererParam}`;

  return <WebPresentButton isMobile={isMobile} renderHref={renderHref} />;
};

const WebPresentButton = ({
  isMobile,
  renderHref,
}: {
  isMobile?: boolean;
  renderHref: string;
}) => {
  const { orgSlug, projectId } = usePluginMetaData();

  const search = useSearch();
  const appendSearch = (href: string) => (search ? `${href}?${search}` : href);

  const [open, setOpen] = useState(false);
  const [showAllScreens, setShowAllScreens] = useState(false);

  const [{ data, fetching }, refetchScreens] =
    useOrganizationScreensIndexPageQuery({
      variables: { slug: orgSlug },
      pause: !open,
    });
  const [{ fetching: assigning }, setExistingProjectToScreen] =
    useSetExistingProjectToScreenMutation();

  const screens = data?.organizationBySlug?.screens.nodes ?? [];
  // Show screens presenting this project first
  const sortedScreens = [...screens].sort((a, b) => {
    const aActive = a.currentProjectId === projectId ? 0 : 1;
    const bActive = b.currentProjectId === projectId ? 0 : 1;
    return aActive - bActive;
  });
  const visibleScreens = showAllScreens
    ? sortedScreens
    : sortedScreens.slice(0, SCREEN_LIMIT);
  const hiddenCount = sortedScreens.length - visibleScreens.length;

  const refresh = () => refetchScreens({ requestPolicy: "network-only" });

  const handlePresent = async (screenId: string, screenName: string) => {
    try {
      await setExistingProjectToScreen({ screenId, projectId });
      toast.success(`Now presenting to ${screenName}`);
      refresh();
    } catch {
      toast.error(`Failed to present to ${screenName}`);
    }
  };

  const handleUnassign = async (screenId: string, screenName: string) => {
    try {
      await setExistingProjectToScreen({
        screenId,
        projectId: null,
      });
      toast.success(`Stopped presenting to ${screenName}`);
      refresh();
    } catch {
      toast.error(`Failed to unassign ${screenName}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-40 bg-black/10"
            onClick={() => setOpen(false)}
          />,
          document.body,
        )}
      <PopoverTrigger asChild>
        <Button
          className={cx(["rt--present-button"])}
          variant="outline"
          size={isMobile ? "mini" : "default"}
        >
          <MdCoPresent />
          Present
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-1 max-h-[min(70vh,28rem)] overflow-y-auto"
        hideCloseButton
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Link
          href={renderHref}
          isExternal
          variant="unstyled"
          onClick={() => setOpen(false)}
          className="flex w-full items-start gap-2 px-3 py-2 text-sm text-left rounded transition-colors cursor-pointer hover:bg-surface-primary-hover focus:bg-surface-primary-hover focus:outline-none"
        >
          <span className="shrink-0 mt-0.5">
            <MdOpenInNew />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Open in new tab</p>
            <p className="text-xs text-tertiary">
              Show the presentation in a new browser tab
            </p>
          </div>
        </Link>

        <div className="px-3 pt-3 pb-1 text-xs font-medium text-tertiary">
          Present to a screen
        </div>

        {fetching && !data && (
          <div className="px-3 py-2 text-sm text-tertiary">
            Loading screens…
          </div>
        )}
        {!fetching && screens.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-tertiary">
            <p className="mb-2">No screens set up yet.</p>
            <Link href={appendSearch(`/o/${orgSlug}/screens`)}>
              Set up a screen
            </Link>
          </div>
        )}
        {visibleScreens.map((screen, screenIndex) => {
          const isShowingThisProject = screen.currentProjectId === projectId;
          const adminHref = appendSearch(
            `/o/${orgSlug}/screens/${screen.slug}/admin`,
          );

          return (
            <div
              key={`${screen.id}-${screenIndex}`}
              className={cx([
                "group flex items-stretch rounded transition-colors hover:bg-surface-primary-hover",
                isShowingThisProject && "bg-surface-primary-hover",
              ])}
            >
              <button
                type="button"
                disabled={assigning || isShowingThisProject}
                onClick={() => handlePresent(screen.id, screen.name)}
                className="flex items-start gap-2 flex-1 min-w-0 px-3 py-2 text-sm text-left cursor-pointer focus:outline-none disabled:cursor-default"
              >
                <span
                  className={cx([
                    "shrink-0 mt-0.5",
                    isShowingThisProject && "text-success",
                  ])}
                >
                  {isShowingThisProject ? <MdCheckCircle /> : <MdMonitor />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{screen.name}</p>
                  <p className="text-xs text-tertiary">
                    {isShowingThisProject
                      ? "Presenting here"
                      : screen.currentProject
                        ? `Showing: ${screen.currentProject.name || "Untitled"}`
                        : "Idle"}
                  </p>
                </div>
              </button>

              <Link
                href={adminHref}
                variant="unstyled"
                className="shrink-0 flex items-center justify-center w-9 self-stretch rounded text-tertiary opacity-0 transition-opacity hover:text-secondary focus-visible:opacity-100 group-hover:opacity-100"
                title="Screen settings"
                aria-label="Screen settings"
              >
                <MdSettings />
              </Link>

              {isShowingThisProject && (
                <button
                  type="button"
                  disabled={assigning}
                  onClick={() => handleUnassign(screen.id, screen.name)}
                  className="shrink-0 flex items-center justify-center w-9 self-stretch rounded text-tertiary cursor-pointer transition-colors hover:text-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Stop presenting to this screen"
                  aria-label="Stop presenting to this screen"
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
            onClick={() => setShowAllScreens((v) => !v)}
            className="w-full px-3 py-2 text-xs font-medium text-secondary text-left rounded cursor-pointer transition-colors hover:bg-surface-primary-hover focus:outline-none"
          >
            {showAllScreens ? "Show less" : `Show ${hiddenCount} more`}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};
