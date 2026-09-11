import useSize from "@react-hook/size";
import { LayoutRenderer } from "@repo/layout/react";
import { useRef, useState } from "react";

import { imageSlideDoc } from "../../src/customSlides";

const MIN_TILE_WIDTH = 96;
const GAP = 6;
const COLLAPSED_ROWS = 2;

const columnsFor = (width: number) =>
  Math.max(1, Math.floor((width + GAP) / (MIN_TILE_WIDTH + GAP)));

export const UploadedSlidesPreview = ({
  mediaNames,
}: {
  mediaNames: string[];
}) => {
  const containerRef = useRef<any>(null);
  const [width] = useSize(containerRef);
  const [isExpanded, setIsExpanded] = useState(false);

  if (mediaNames.length === 0) return null;

  const columns = columnsFor(width);

  // Cut on a row boundary so the "+N" tile always ends a row
  const collapsedCount = columns * COLLAPSED_ROWS;
  const isCollapsed = !isExpanded && mediaNames.length > collapsedCount;
  const visible = isCollapsed
    ? mediaNames.slice(0, collapsedCount)
    : mediaNames;
  const hiddenCount = mediaNames.length - visible.length;

  return (
    <div
      ref={containerRef}
      className="grid"
      style={{
        gap: `${GAP}px`,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {width > 0 &&
        visible.map((mediaName, i) => {
          const isLastVisible = i === visible.length - 1;

          return (
            <div
              key={`${mediaName}-${i}`}
              className="relative overflow-hidden bg-black ring-1 ring-stroke"
            >
              <LayoutRenderer
                doc={imageSlideDoc(mediaName)}
                data={{}}
                sizing="aspect"
              />

              {isCollapsed && isLastVisible && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm font-medium cursor-pointer transition-colors hover:bg-black/40 focus-visible:bg-black/40 focus-visible:outline-none"
                >
                  +{hiddenCount}
                </button>
              )}
            </div>
          );
        })}
    </div>
  );
};
