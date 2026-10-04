import { Button, Toggle } from "@repo/ui";
import { cx } from "class-variance-authority";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdCheck, MdEdit, MdSpeakerNotes } from "react-icons/md";

import { getImportSlideCount, resolveSlide } from "../../../src/slides/order";
import type { ResolvedSlide } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { TimerPanel } from "./TimerPanel";
import { joinAllNotes, splitAllNotes } from "./allNotes";

const getSpeakerNotes = (slide: ResolvedSlide | null): string => {
  if (!slide) return "";
  return slide.importData.speakerNotes?.[slide.localSlideIndex] ?? "";
};

type NotesTarget = { importId: string; slideIndex: number };

const targetOf = (slide: ResolvedSlide): NotesTarget => ({
  importId: slide.ref.importId,
  slideIndex: slide.localSlideIndex,
});

const useSetSpeakerNotes = () => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();

  return useCallback(
    (entries: { target: NotesTarget; notes: string }[]) => {
      for (const { target, notes } of entries) {
        const importData = mutableSceneData.pluginData.imports[target.importId];
        if (!importData) continue;

        const current = importData.speakerNotes;
        if ((current?.[target.slideIndex] ?? "") === notes) continue;

        if (current && target.slideIndex < current.length) {
          current[target.slideIndex] = notes;
          continue;
        }
        // Imports without notes (or with fewer entries) get a full array
        const next = Array.from(
          { length: getImportSlideCount(importData) },
          (_, i) => current?.[i] ?? "",
        );
        next[target.slideIndex] = notes;
        importData.speakerNotes = next;
      }
    },
    [mutableSceneData],
  );
};

type Editing =
  | { kind: "slide"; target: NotesTarget; draft: string }
  | {
      kind: "all";
      targets: NotesTarget[];
      draft: string;
      error: string | null;
    };

export const SpeakerNotesPanel = ({
  slide,
}: {
  slide: ResolvedSlide | null;
}) => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const setSpeakerNotes = useSetSpeakerNotes();

  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);

  const allSlides = useMemo(
    () =>
      (pluginData.slideOrder ?? [])
        .map((_, i) => resolveSlide(pluginData, i))
        .filter((x): x is ResolvedSlide => !!x),
    [pluginData],
  );

  const notes = getSpeakerNotes(slide);

  const editingRef = useRef(editing);
  editingRef.current = editing;

  /** Saves the draft and closes the editor, unless the draft can't be read. */
  const finishEditing = useCallback(() => {
    const current = editingRef.current;
    if (!current) return;

    if (current.kind === "slide") {
      setSpeakerNotes([{ target: current.target, notes: current.draft }]);
    } else {
      const result = splitAllNotes(current.draft, current.targets.length);
      if (!result.ok) {
        setEditing({ ...current, error: result.error });
        return;
      }
      setSpeakerNotes(
        current.targets.map((target, i) => ({
          target,
          notes: result.notes[i]!,
        })),
      );
    }
    editingRef.current = null;
    setEditing(null);
  }, [setSpeakerNotes]);

  const startEditing = () => {
    if (showAll) {
      setEditing({
        kind: "all",
        targets: allSlides.map(targetOf),
        draft: joinAllNotes(allSlides.map(getSpeakerNotes)),
        error: null,
      });
    } else if (slide) {
      setEditing({ kind: "slide", target: targetOf(slide), draft: notes });
    }
  };

  // A single slide's edit belongs to that slide; moving on saves it.
  const slideKey = slide
    ? `${slide.ref.importId}:${slide.localSlideIndex}`
    : null;
  const editingSlideKey =
    editing?.kind === "slide"
      ? `${editing.target.importId}:${editing.target.slideIndex}`
      : null;
  useEffect(() => {
    if (editingSlideKey && editingSlideKey !== slideKey) finishEditing();
  }, [editingSlideKey, slideKey, finishEditing]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editingKind = editing?.kind ?? null;
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    if (editingKind === "slide") {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, [editingKind, editingSlideKey]);

  // Keep the current slide's notes in view when showing all of them
  const currentRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (showAll && !editing) {
      currentRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [showAll, editing, slide?.globalSlideIndex]);

  const canEdit = showAll ? allSlides.length > 0 : !!slide;

  return (
    <aside className="flex min-h-0 flex-col border-t border-stroke bg-surface-secondary portrait:min-h-48 portrait:flex-1 landscape:w-[38%] landscape:max-w-[34rem] landscape:shrink-0 landscape:border-l landscape:border-t-0">
      {/* In landscape the view's close button sits over the right corner */}
      <div className="flex h-13 shrink-0 items-center gap-2 border-b border-stroke px-4 landscape:pr-14">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-secondary">
          <MdSpeakerNotes />
          Speaker notes
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Toggle
            size="sm"
            pressed={showAll}
            disabled={!!editing}
            onPressedChange={setShowAll}
            aria-label="Show notes for all slides"
            className="px-2 text-xs"
          >
            All slides
          </Toggle>
          {canEdit &&
            (editing ? (
              <Button
                size="xs"
                variant="outline"
                // Keep focus in the textarea so its blur doesn't race the click
                onMouseDown={(e) => e.preventDefault()}
                onClick={finishEditing}
                aria-label="Done editing notes"
              >
                <MdCheck />
                Done
              </Button>
            ) : (
              <Button
                size="xs"
                variant="ghost"
                aria-label="Edit notes"
                onClick={startEditing}
              >
                <MdEdit />
                Edit
              </Button>
            ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {editing ? (
          <div className="flex h-full flex-col gap-2">
            {editing.kind === "all" && (
              <p
                role={editing.error ? "alert" : undefined}
                className={cx(
                  "shrink-0 text-xs",
                  editing.error ? "text-fill-destructive" : "text-tertiary",
                )}
              >
                {editing.error ??
                  "Each slide starts at its --- line. Keep one per slide."}
              </p>
            )}
            <textarea
              ref={textareaRef}
              aria-label="Speaker notes"
              value={editing.draft}
              onChange={(e) =>
                setEditing({ ...editing, draft: e.target.value })
              }
              // All slides at once saves only on Done: a half-edited
              // separator would otherwise drop notes.
              onBlur={editing.kind === "slide" ? finishEditing : undefined}
              onKeyDown={(e) => {
                if (e.key === "Escape") finishEditing();
              }}
              placeholder="Add notes for this slide"
              className="min-h-32 w-full flex-1 resize-none rounded-sm border border-stroke bg-transparent p-2 text-sm leading-relaxed text-primary outline-none placeholder:text-tertiary focus-visible:border-ring sm:text-base"
            />
          </div>
        ) : showAll ? (
          <ol className="flex flex-col gap-4">
            {allSlides.map((each) => {
              const isCurrent =
                each.globalSlideIndex === slide?.globalSlideIndex;
              const text = getSpeakerNotes(each);
              return (
                <li
                  key={each.rawRef}
                  ref={isCurrent ? currentRef : undefined}
                  aria-current={isCurrent ? "true" : undefined}
                  className={cx(
                    "border-l-2 pl-3",
                    isCurrent ? "border-stroke-emphasis" : "border-transparent",
                  )}
                >
                  <div
                    className={cx(
                      "mb-1 text-xs font-medium",
                      isCurrent ? "text-primary" : "text-tertiary",
                    )}
                  >
                    Slide {each.globalSlideIndex + 1}
                  </div>
                  {text ? (
                    <p
                      className={cx(
                        "whitespace-pre-wrap text-sm leading-relaxed sm:text-base",
                        isCurrent ? "text-primary" : "text-secondary",
                      )}
                    >
                      {text}
                    </p>
                  ) : (
                    <p className="text-sm italic text-tertiary">No notes</p>
                  )}
                </li>
              );
            })}
          </ol>
        ) : notes ? (
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
