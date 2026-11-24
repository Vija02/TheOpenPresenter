import { Input, ToggleGroup, ToggleGroupItem } from "@repo/ui";

export const PREVIEW_SIZES = [24, 36, 48, 64];
export const DEFAULT_PREVIEW_SIZE = 36;

export const FontPreviewControls = ({
  text,
  onTextChange,
  size,
  onSizeChange,
}: {
  text: string;
  onTextChange: (text: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
}) => (
  <div className="bp--font-controls">
    <Input
      className="bp--font-controls__text"
      placeholder="Type something to preview"
      value={text}
      onChange={(e) => onTextChange(e.target.value)}
    />
    <ToggleGroup
      type="single"
      size="sm"
      value={String(size)}
      onValueChange={(v) => v && onSizeChange(Number(v))}
      aria-label="Preview size"
    >
      {PREVIEW_SIZES.map((s) => (
        <ToggleGroupItem key={s} value={String(s)} aria-label={`${s} pixels`}>
          {s}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  </div>
);
