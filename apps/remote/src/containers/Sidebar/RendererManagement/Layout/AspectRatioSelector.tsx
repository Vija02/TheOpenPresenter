import { LayoutAspectRatio, layoutAspectRatioPresets } from "@repo/base-plugin";
import { Button } from "@repo/ui";

type AspectRatioSelectorProps = {
  currentAspectRatio: LayoutAspectRatio | undefined;
  onSelect: (aspectRatio: LayoutAspectRatio) => void;
};

const AspectRatioSelector = ({
  currentAspectRatio,
  onSelect,
}: AspectRatioSelectorProps) => {
  return (
    <div className="flex flex-col gap-2 items-start">
      <p className="font-medium text-sm">Aspect Ratio</p>
      <div className="flex flex-wrap gap-2">
        {layoutAspectRatioPresets.map((preset) => {
          const isSelected =
            currentAspectRatio?.width === preset.width &&
            currentAspectRatio?.height === preset.height;
          return (
            <Button
              key={preset.label}
              size="sm"
              variant={isSelected ? "default" : "outline"}
              onClick={() =>
                onSelect({
                  width: preset.width,
                  height: preset.height,
                })
              }
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default AspectRatioSelector;
