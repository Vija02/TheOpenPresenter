import { KeyboardEvent, ReactNode } from "react";
import { LuChevronUp } from "react-icons/lu";

import { MediaStripState } from "./useMediaStripState";

export const MediaStripWrapper = ({
  panel,
  children,
}: {
  panel: MediaStripState;
  children: ReactNode;
}) => (
  <>
    <div
      className="lay--media-handle"
      data-open={panel.open ? "" : undefined}
      data-dragging={panel.dragging ? "" : undefined}
      data-testid={panel.open ? undefined : "layout-media-open"}
      {...(panel.open
        ? {
            role: "separator",
            "aria-orientation": "horizontal" as const,
            "aria-label": "Resize media library",
          }
        : {
            role: "button",
            tabIndex: 0,
            title: "Click or drag up to open",
            onClick: panel.onBarClick,
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              panel.show();
            },
          })}
      {...panel.dragProps}
    >
      {!panel.open && (
        <>
          <LuChevronUp /> Media library
        </>
      )}
    </div>
    {panel.open && (
      <div
        className="shrink-0 min-h-0 flex px-4"
        style={{ height: panel.height }}
      >
        {children}
      </div>
    )}
  </>
);
