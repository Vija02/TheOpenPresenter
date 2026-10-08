import type { MediaPickerResult } from "@repo/base-types";
import {
  FillPaint,
  LayoutDoc,
  VideoPlaybackMode,
  cloneDoc,
} from "@repo/layout";
import { LayoutWorkbench, mediaToFill } from "@repo/layout/editor";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui";
import { ReactNode, useCallback, useMemo, useState } from "react";

import {
  Background,
  NO_BACKGROUND,
  backgroundFill,
  backgroundFromFill,
  backgroundPlayback,
  isNoBackground,
  withBackgroundPlayback,
} from "../../src/backgrounds";
import {
  FULL_SONG_LOOK,
  LOWER_THIRD_LOOK,
  Look,
  MAIN_LOOK,
  presetsForLook,
} from "../../src/looks";
import { GroupedData } from "../../src/processLyrics";
import { processSong } from "../../src/songHelpers";
import {
  composeLayout,
  fullSongLayout,
  isLyricsElement,
  textLayout,
} from "../../src/template/layout";
import { findLyricsTemplate, lyricsBindings } from "../../src/template/presets";
import {
  fullSongFrame,
  sectionsFrame,
  slideAt,
} from "../../src/template/toFrame";
import { Song } from "../../src/types";
import { usePluginAPI } from "../pluginApi";

export type LayoutValue = {
  template: LayoutDoc;
  background: Background | null;
};

/** A library item as a background, or null for media that can't be one */
const backgroundFromPicked = (
  picked: MediaPickerResult,
  playback: VideoPlaybackMode,
): Background | null => {
  const fill = mediaToFill(picked);
  return fill
    ? withBackgroundPlayback(backgroundFromFill(fill), playback)
    : null;
};

const undoFullSongFit = (
  edited: LayoutDoc,
  original: LayoutDoc,
): LayoutDoc => ({
  ...edited,
  elements: edited.elements.map((element) => {
    if (element.type !== "text" || !isLyricsElement(element)) return element;
    if (element.fit !== "columns") return element;
    const before = original.elements.find((e) => e.id === element.id);
    return before?.type === "text" ? { ...element, fit: before.fit } : element;
  }),
});

type SampleSong = Pick<Song, "title" | "author" | "content" | "setting">;

/** For looks shown without a song */
const SAMPLES: Record<string, SampleSong> = {
  [MAIN_LOOK]: {
    title: "How Great Thou Art",
    author: "Carl Boberg",
    content:
      "[Chorus]\nThen sings my soul\nMy Saviour God to Thee\nHow great Thou art\nHow great Thou art",
    setting: { displayType: "sections" },
  },
  // Long enough to flow into columns
  [FULL_SONG_LOOK]: {
    title: "Amazing Grace",
    author: "John Newton",
    content: [
      "[Verse 1]",
      "Amazing grace! How sweet the sound",
      "That saved a wretch like me",
      "I once was lost, but now am found",
      "Was blind, but now I see",
      "",
      "[Verse 2]",
      "'Twas grace that taught my heart to fear",
      "And grace my fears relieved",
      "How precious did that grace appear",
      "The hour I first believed",
      "",
      "[Verse 3]",
      "Through many dangers, toils and snares",
      "I have already come",
      "'Tis grace hath brought me safe thus far",
      "And grace will lead me home",
    ].join("\n"),
    setting: { displayType: "fullSong" },
  },
  [LOWER_THIRD_LOOK]: {
    title: "How Great Thou Art",
    author: "Carl Boberg",
    content: "[Chorus]\nThen sings my soul\nMy Saviour God to Thee",
    setting: { displayType: "sections" },
  },
};

const sampleFor = (lookKey: string) => SAMPLES[lookKey] ?? SAMPLES[MAIN_LOOK]!;

const LOWER_THIRD_LINES = 2;

const clipLines = (groups: GroupedData, max: number): GroupedData =>
  groups.map((group) => ({
    ...group,
    slides: group.slides.map((lines) => lines.slice(0, max)),
  }));

type LookOption = Pick<Look, "key" | "name">;

type LayoutEditorDialogProps = {
  isOpen: boolean;
  onToggle: () => void;
  title: ReactNode;
  looks: LookOption[];
  initialLook: string;
  valueFor: (lookKey: string) => LayoutValue;
  /**
   * What a look's null background falls back to, e.g. the organization's for
   * a song. None is then saved as `NO_BACKGROUND`. Omitted: null is none
   */
  fallbackFor?: (lookKey: string) => { background: Background | null };
  /** Only the looks that were edited, by key */
  onSave: (edited: Record<string, LayoutValue>) => void;
  /** Shown on the canvas. Falls back to the look's sample */
  sampleSong?: SampleSong | null;
  aiThreadKey: (lookKey: string) => string;
  footerStart?: (controls: {
    lookKey: string;
    /** As currently edited */
    value: LayoutValue;
    setValue: (value: LayoutValue) => void;
  }) => ReactNode;
};

/**
 * Edits looks: each one's text template, and the background, which is its
 * own layer, drawn under the canvas, never selectable, and set from the
 * media library
 */
export const LayoutEditorDialog = ({
  isOpen,
  onToggle,
  ...props
}: LayoutEditorDialogProps) => (
  <Dialog open={isOpen} onOpenChange={onToggle}>
    <DialogContent
      size="full"
      className="desktop:w-[96vw] desktop:max-w-[1400px] desktop:h-[88vh] flex flex-col p-0 gap-0"
    >
      {/* Mounted per open, so each starts from what is saved */}
      {isOpen && <LayoutEditorBody onToggle={onToggle} {...props} />}
    </DialogContent>
  </Dialog>
);

const LayoutEditorBody = ({
  onToggle,
  title,
  looks,
  initialLook,
  valueFor,
  fallbackFor,
  onSave,
  sampleSong,
  aiThreadKey,
  footerStart,
}: Omit<LayoutEditorDialogProps, "isOpen">) => {
  const [lookKey, setLookKey] = useState(initialLook);
  // Edits so far, kept while switching between looks
  const [drafts, setDrafts] = useState<Record<string, LayoutValue>>({});

  // Stable, and a plain copy the workbench can't reach back through
  const saved = useMemo(() => {
    const { template, background } = valueFor(lookKey);
    return {
      template: cloneDoc(template),
      background: background ? cloneDoc(background) : null,
    };
  }, [valueFor, lookKey]);

  const value = drafts[lookKey] ?? saved;

  const update = useCallback(
    (fn: (value: LayoutValue) => LayoutValue) =>
      setDrafts((current) => ({
        ...current,
        [lookKey]: fn(current[lookKey] ?? saved),
      })),
    [lookKey, saved],
  );

  const save = () => {
    // Plain data: no proxies, no undefined
    const edited: Record<string, LayoutValue> = {};
    for (const [key, draft] of Object.entries(drafts)) {
      edited[key] = {
        template: cloneDoc(textLayout(draft.template)),
        background: draft.background ? cloneDoc(draft.background) : null,
      };
    }
    onSave(edited);
    onToggle();
  };

  return (
    <>
      <DialogHeader className="px-4 py-3 border-b border-stroke shrink-0">
        <div className="stack-row flex-wrap gap-3">
          <DialogTitle>{title}</DialogTitle>
          {looks.length > 1 && (
            <ToggleGroup
              type="single"
              size="sm"
              value={lookKey}
              aria-label="Look"
              data-testid="lyrics-look-switcher"
              onValueChange={(next) => {
                if (next) setLookKey(next);
              }}
            >
              {looks.map((look) => (
                <ToggleGroupItem
                  key={look.key}
                  value={look.key}
                  className="px-2 text-xs"
                >
                  {look.name}
                  {drafts[look.key] && (
                    <span
                      className="inline-block size-2 rounded-full bg-gray-600"
                      role="img"
                      aria-label="Edited"
                      title="Edited"
                    />
                  )}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>
      </DialogHeader>

      <DialogBody className="flex-1 min-h-0 p-0 overflow-hidden">
        <LookEditor
          key={lookKey}
          lookKey={lookKey}
          value={value}
          update={update}
          fallback={fallbackFor?.(lookKey)}
          sampleSong={sampleSong}
          aiThreadKey={aiThreadKey(lookKey)}
        />
      </DialogBody>

      <DialogFooter className="px-4 py-3 border-t border-stroke shrink-0">
        <div className="stack-row justify-between w-full">
          <div className="stack-row">
            {footerStart?.({
              lookKey,
              value,
              setValue: (next) =>
                update(() => ({
                  template: cloneDoc(next.template),
                  background: next.background
                    ? cloneDoc(next.background)
                    : null,
                })),
            })}
          </div>
          <div className="stack-row">
            <Button variant="outline" onClick={onToggle}>
              Cancel
            </Button>
            <Button variant="success" onClick={save}>
              Save
            </Button>
          </div>
        </div>
      </DialogFooter>
    </>
  );
};

const LookEditor = ({
  lookKey,
  value,
  update,
  fallback,
  sampleSong,
  aiThreadKey,
}: {
  lookKey: string;
  value: LayoutValue;
  update: (fn: (value: LayoutValue) => LayoutValue) => void;
  fallback?: { background: Background | null };
  sampleSong?: SampleSong | null;
  aiThreadKey: string;
}) => {
  const pluginApi = usePluginAPI();
  const { template, background } = value;

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  // What shows: the fallback stands in for null
  const shown = background ?? fallback?.background ?? null;

  // For videos picked from here on. The toggle shows the current video's own
  const [playback, setPlayback] = useState<VideoPlaybackMode>(
    () => (shown && backgroundPlayback(shown)) ?? "loop",
  );

  const setBackground = useCallback(
    (next: Background | null) => update((v) => ({ ...v, background: next })),
    [update],
  );

  // Media keeps the current playback choice. Null is the "None" card
  const applyMedia = useCallback(
    (picked: MediaPickerResult | null) => {
      if (!picked) {
        setBackground(fallback ? NO_BACKGROUND : null);
        return;
      }
      const next = backgroundFromPicked(picked, playback);
      if (next) setBackground(next);
    },
    [playback, fallback, setBackground],
  );

  const applyColour = useCallback(
    (fill: FillPaint) => setBackground(backgroundFromFill(fill)),
    [setBackground],
  );

  const shownFill =
    shown && !isNoBackground(shown) ? backgroundFill(shown) : null;
  const isVideo = shownFill?.type === "video";

  const templates = useMemo(
    () =>
      presetsForLook(lookKey).map((preset) => ({
        ...preset,
        doc: composeLayout(preset.doc, shown),
      })),
    [lookKey, shown],
  );

  const onSelectTemplate = useCallback(
    (templateId: string) => {
      const preset = findLyricsTemplate(templateId);
      if (!preset) return;
      const ok = window.confirm(
        `Replace the current layout with "${preset.name}"? Any elements you have moved or resized will be lost. The background stays.`,
      );
      if (!ok) return;
      update((v) => ({ ...v, template: cloneDoc(preset.doc) }));
      setActiveTemplateId(templateId);
    },
    [update],
  );

  const isFullSong = lookKey === FULL_SONG_LOOK;
  const canvasDoc = useMemo(
    () => (isFullSong ? fullSongLayout(template) : template),
    [isFullSong, template],
  );
  const onCanvasChange = useCallback(
    (next: LayoutDoc) =>
      update((v) => ({
        ...v,
        template: isFullSong ? undoFullSongFit(next, v.template) : next,
      })),
    [isFullSong, update],
  );

  const data = useMemo(() => {
    const sample = sampleFor(lookKey);
    for (const song of [sampleSong, sample]) {
      if (!song) continue;
      let groups = processSong(song.content, song.setting.sectionOrder);
      if (!slideAt(groups, 0)?.lines.length) continue;
      if (lookKey === LOWER_THIRD_LOOK) {
        groups = clipLines(groups, LOWER_THIRD_LINES);
      }
      return isFullSong
        ? fullSongFrame(song, groups)
        : sectionsFrame(song, groups, 0);
    }
    return sectionsFrame(sample, [], 0);
  }, [sampleSong, lookKey, isFullSong]);

  return (
    <LayoutWorkbench
      doc={canvasDoc}
      onChange={onCanvasChange}
      underlay={shown}
      media
      mediaAction={applyMedia}
      mediaColourAction={applyColour}
      mediaSelection={shownFill}
      mediaHeaderExtras={
        isVideo && (
          <PlaybackChoice
            value={(shown && backgroundPlayback(shown)) ?? playback}
            onChange={(next) => {
              setPlayback(next);
              if (shown) setBackground(withBackgroundPlayback(shown, next));
            }}
          />
        )
      }
      data={data}
      templates={templates}
      activeTemplateId={activeTemplateId}
      onSelectTemplate={onSelectTemplate}
      bindings={lyricsBindings}
      aiThreadKey={aiThreadKey}
      pluginApi={pluginApi}
    />
  );
};

/** Only shown while a video is the background */
const PlaybackChoice = ({
  value,
  onChange,
}: {
  value: VideoPlaybackMode;
  onChange: (playback: VideoPlaybackMode) => void;
}) => (
  <ToggleGroup
    type="single"
    size="sm"
    value={value}
    aria-label="Video playback"
    data-testid="lyrics-background-playback"
    onValueChange={(next) => {
      if (next === "loop" || next === "once") onChange(next);
    }}
  >
    <ToggleGroupItem value="loop" className="px-2 text-xs">
      Loop
    </ToggleGroupItem>
    <ToggleGroupItem value="once" className="px-2 text-xs">
      Play once
    </ToggleGroupItem>
  </ToggleGroup>
);
