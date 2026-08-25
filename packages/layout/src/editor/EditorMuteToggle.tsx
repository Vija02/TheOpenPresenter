import { MdVolumeOff, MdVolumeUp } from "react-icons/md";

import { audibleVideoElements } from "../doc/edit";
import type { LayoutDoc } from "../schema/document";

export const hasAudibleVideo = (doc: LayoutDoc): boolean =>
  audibleVideoElements(doc).length > 0;

export type EditorMuteToggleProps = {
  muted: boolean;
  onToggle: () => void;
  className?: string;
};

/** Mutes the canvas preview */
export const EditorMuteToggle = ({
  muted,
  onToggle,
  className,
}: EditorMuteToggleProps) => (
  <button
    type="button"
    title={muted ? "Unmute preview" : "Mute preview"}
    aria-label={muted ? "Unmute preview" : "Mute preview"}
    aria-pressed={muted}
    onPointerDown={(e) => e.stopPropagation()}
    onClick={onToggle}
    className={`flex cursor-pointer items-center rounded-lg border border-stroke bg-surface-primary p-2 text-secondary shadow-md transition-colors hover:bg-surface-secondary hover:text-primary ${
      className ?? ""
    }`}
  >
    {muted ? <MdVolumeOff size={16} /> : <MdVolumeUp size={16} />}
  </button>
);
