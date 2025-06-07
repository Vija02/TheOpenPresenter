import { useWindowWidth } from "@react-hook/window-size";
import { Button, SlideGrid, cn } from "@repo/ui";
import { useMemo, useState } from "react";
import { FaChevronUp } from "react-icons/fa6";

import "./MobilePreview.css";

export const MobilePreview = ({ preview }: { preview: React.ReactNode }) => {
  const [previewOpen, setPreviewOpen] = useState<boolean | null>(null);
  const windowWidth = useWindowWidth();

  const width = useMemo(() => {
    if (windowWidth > 550) {
      return windowWidth / 2 - 40;
    }
    return Math.min(380, windowWidth - 40);
  }, [windowWidth]);

  return (
    <div className="border-b border-b-stroke">
      <Button
        className="flex md:hidden gap-2 rounded-none w-full font-bold"
        type="button"
        variant="ghost"
        onClick={() => setPreviewOpen((prev) => !prev)}
      >
        Preview
        <FaChevronUp
          style={{
            transform: previewOpen ? "rotate(180deg)" : "",
          }}
        />
      </Button>
      <div className="block md:hidden">
        <div
          className={cn(
            "overflow-auto h-0",
            previewOpen
              ? "pl-lyrics--mobile-preview-pane__open"
              : // If null, we don't want to animate since it's first load
                // So we check for false here
                previewOpen === false
                ? "pl-lyrics--mobile-preview-pane__close"
                : "",
          )}
        >
          <SlideGrid forceWidth={width}>{preview}</SlideGrid>
        </div>
      </div>
    </div>
  );
};
