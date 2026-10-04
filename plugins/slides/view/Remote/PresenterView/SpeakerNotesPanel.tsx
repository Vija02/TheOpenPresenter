import { MdSpeakerNotes } from "react-icons/md";

import type { ResolvedSlide } from "../../../src/types";
import { TimerPanel } from "./TimerPanel";

const getSpeakerNotes = (slide: ResolvedSlide | null): string => {
  if (!slide) return "";
  return slide.importData.speakerNotes?.[slide.localSlideIndex] ?? "";
};

export const SpeakerNotesPanel = ({
  slide,
}: {
  slide: ResolvedSlide | null;
}) => {
  const notes = getSpeakerNotes(slide);

  return (
    <aside className="flex min-h-0 flex-col border-t border-stroke bg-surface-secondary portrait:min-h-48 portrait:flex-1 landscape:w-[38%] landscape:max-w-[34rem] landscape:shrink-0 landscape:border-l landscape:border-t-0">
      <div className="flex h-13 shrink-0 items-center gap-2 border-b border-stroke px-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-secondary">
          <MdSpeakerNotes />
          Speaker notes
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {notes ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-primary sm:text-base">
            {notes}
          </p>
        ) : (
          <p className="text-sm italic text-tertiary">
            {slide
              ? "No notes for this slide"
              : "No slide is currently showing"}
          </p>
        )}
      </div>
      <TimerPanel />
    </aside>
  );
};
