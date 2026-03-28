import { useData } from "@repo/shared";
import { Button } from "@repo/ui";
import { cx } from "class-variance-authority";
import { useMemo } from "react";

import { useRendererSelection } from "../../../contexts/rendererSelection";

const RendererSelector = () => {
  const data = useData();
  const { selectedRendererId, setSelectedRendererId } = useRendererSelection();

  const rendererIds = useMemo(
    () => Object.keys(data.renderer).sort(),
    [data.renderer],
  );

  if (rendererIds.length <= 1) {
    return null;
  }

  return (
    <div className="flex gap-1">
      {rendererIds.map((rendererId) => (
        <Button
          key={rendererId}
          size="mini"
          variant={selectedRendererId === rendererId ? "default" : "outline"}
          onClick={() => setSelectedRendererId(rendererId)}
          className={cx(
            "min-w-[28px] h-6 px-2 text-xs",
            selectedRendererId === rendererId && "font-bold",
          )}
          title={`Control Screen ${rendererId}`}
        >
          {rendererId}
        </Button>
      ))}
    </div>
  );
};

export default RendererSelector;
