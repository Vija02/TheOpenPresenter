import * as SliderPrimitive from "@radix-ui/react-slider";

import "./VolumeBar.css";

type VolumeBarPropTypes = {
  volume?: number;
  onChange?: (v: number) => void;
};

export const VolumeBar = ({ volume, onChange }: VolumeBarPropTypes) => {
  return (
    <div className="ui--volume-bar">
      <p className="text-xs font-bold">VOL</p>
      <SliderPrimitive.Root
        data-slot="slider"
        value={[volume ?? 1]}
        min={0}
        max={1}
        step={0.01}
        orientation="vertical"
        onValueChange={(v) => onChange?.(v[0])}
        className="ui--volume-bar-root"
      >
        <SliderPrimitive.Track className="ui--volume-bar-track">
          <SliderPrimitive.Range className="ui--volume-bar-range" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="ui--volume-bar-thumb" />
      </SliderPrimitive.Root>
    </div>
  );
};
