import {
  Button,
  OverlayToggle,
  PopConfirm,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui";
import { cx } from "class-variance-authority";
import { MdCoPresent, MdOutlineCancelPresentation } from "react-icons/md";

import { usePresentHere } from "../../../contexts/presentHere";
import { LazyPresentModal } from "./LazyPresentModal";
import PresentOverlay from "./PresentOverlay";
import "./index.css";
import { useRenderUrl } from "./renderUrl";
import { usePresentStatus } from "./usePresentStatus";

export const PresentButton = ({
  isMobile,
  size,
  className,
  showStop = true,
}: {
  isMobile?: boolean;
  /** Off in the top bar: too close to its other buttons */
  showStop?: boolean;
  /** Overrides the size picked from `isMobile`, eg. for the top bar */
  size?: "sm";
  className?: string;
}) => {
  const buttonSize = size ?? (isMobile ? "mini" : "default");
  const { stoppableOutputIds, stopAll } = usePresentStatus();
  const canStop = showStop && stoppableOutputIds.length > 0;

  return (
    <div
      className={cx([
        "rt--present-group",
        canStop && "rt--present-group__live",
        className,
      ])}
    >
      <OverlayToggle
        isLazy
        toggler={({ onToggle }) => (
          <Button
            className="rt--present-button"
            variant="outline"
            size={buttonSize}
            onClick={onToggle}
          >
            <MdCoPresent />
            Present
          </Button>
        )}
      >
        <LazyPresentModal />
      </OverlayToggle>

      {canStop && (
        <Tooltip>
          <PopConfirm
            title="Stop presenting?"
            description="Closes everything you're presenting."
            okText="Stop"
            onConfirm={stopAll}
            popoverProps={{ align: "end" }}
          >
            <TooltipTrigger asChild>
              <Button
                className="rt--present-stop"
                variant="outline"
                size={buttonSize === "default" ? "icon" : buttonSize}
                aria-label="Stop Presenting"
              >
                <MdOutlineCancelPresentation />
              </Button>
            </TooltipTrigger>
          </PopConfirm>
          <TooltipContent>Stop presenting</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

/** "This screen". Mount once. */
export const PresentHereHost = () => {
  const { outputId, stop } = usePresentHere();
  const renderUrl = useRenderUrl();

  if (outputId === null) return null;

  return (
    <PresentOverlay
      renderUrl={renderUrl(outputId)}
      onClose={() => {
        stop();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }}
    />
  );
};
