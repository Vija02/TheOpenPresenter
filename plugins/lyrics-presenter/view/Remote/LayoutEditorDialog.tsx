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
import { processSong } from "../../src/songHelpers";
import {
  composeLayout,
  fullSongLayout,
  isLyricsElement,
  textLayout,
} from "../../src/template/layout";
import {
  findLyricsTemplate,
  lyricsBindings,
  lyricsTemplates,
} from "../../src/template/presets";
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

const SAMPLE_SONG: Pick<Song, "title" | "author" | "content" | "setting"> = {
  title: "How Great Thou Art",
  author: "Carl Boberg",
  content:
    "[Chorus]\nThen sings my soul\nMy Saviour God to Thee\nHow great Thou art\nHow great Thou art",
  setting: { displayType: "sections" },
};

type LayoutEditorDialogProps = {
  isOpen: boolean;
  onToggle: () => void;
  title: ReactNode;
  value: LayoutValue;
  onSave: (value: LayoutValue) => void;
  sampleSong?: Pick<Song, "title" | "author" | "content" | "setting"> | null;
  fallback?: { background: Background | null };
  aiThreadKey: string;
  /** Left of the footer, e.g. a reset */
  footerStart?: (controls: {
    setValue: (value: LayoutValue) => void;
  }) => ReactNode;
};

export const LayoutEditorDialog = ({
  isOpen,
  onToggle,
  title,
  ...props
}: LayoutEditorDialogProps) => (
  <Dialog open={isOpen} onOpenChange={onToggle}>
    <DialogContent
      size="full"
      className="desktop:w-[96vw] desktop:max-w-[1400px] desktop:h-[88vh] flex flex-col p-0 gap-0"
    >
      <DialogHeader className="px-4 py-3 border-b border-stroke shrink-0">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      {/* Mounted per open, so each starts from what is saved */}
      {isOpen && <LayoutEditorBody onToggle={onToggle} {...props} />}
    </DialogContent>
  </Dialog>
);

const LayoutEditorBody = ({
  onToggle,
  value,
  onSave,
  sampleSong,
  fallback,
  aiThreadKey,
  footerStart,
}: Omit<LayoutEditorDialogProps, "isOpen" | "title">) => {
  const pluginApi = usePluginAPI();

  // The workbench edits only the text. The background is its own layer:
  // drawn under the canvas, set from the media strip or the bar below
  const [template, setTemplate] = useState<LayoutDoc>(() =>
    cloneDoc(value.template),
  );
  const [background, setBackground] = useState<Background | null>(() =>
    value.background ? cloneDoc(value.background) : null,
  );
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  // What shows: the fallback stands in for null
  const shown = background ?? fallback?.background ?? null;

  // For videos picked from here on. The toggle shows the current video's own
  const [playback, setPlayback] = useState<VideoPlaybackMode>(
    () => (shown && backgroundPlayback(shown)) ?? "loop",
  );

  const setValue = useCallback((next: LayoutValue) => {
    setTemplate(cloneDoc(next.template));
    setBackground(next.background ? cloneDoc(next.background) : null);
    setActiveTemplateId(null);
  }, []);

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
    [playback, fallback],
  );

  const applyColour = useCallback(
    (fill: FillPaint) => setBackground(backgroundFromFill(fill)),
    [],
  );

  const shownFill =
    shown && !isNoBackground(shown) ? backgroundFill(shown) : null;
  const isVideo = shownFill?.type === "video";

  // Thumbnails only: presets carry no background
  const templates = useMemo(
    () =>
      lyricsTemplates.map((preset) => ({
        ...preset,
        doc: composeLayout(preset.doc, shown),
      })),
    [shown],
  );

  const onSelectTemplate = useCallback((templateId: string) => {
    const preset = findLyricsTemplate(templateId);
    if (!preset) return;
    const ok = window.confirm(
      `Replace the current layout with "${preset.name}"? Any elements you have moved or resized will be lost. The background stays.`,
    );
    if (!ok) return;
    setTemplate(cloneDoc(preset.doc));
    setActiveTemplateId(templateId);
  }, []);

  // A full song is edited as the output draws it, in columns
  const isFullSong = sampleSong?.setting.displayType === "fullSong";
  const canvasDoc = useMemo(
    () => (isFullSong ? fullSongLayout(template) : template),
    [isFullSong, template],
  );
  const onCanvasChange = useCallback(
    (next: LayoutDoc) =>
      setTemplate((current) =>
        isFullSong ? undoFullSongFit(next, current) : next,
      ),
    [isFullSong],
  );

  const data = useMemo(() => {
    for (const song of [sampleSong, SAMPLE_SONG]) {
      if (!song) continue;
      const groups = processSong(song.content, song.setting.sectionOrder);
      if (!slideAt(groups, 0)?.lines.length) continue;
      return isFullSong && song === sampleSong
        ? fullSongFrame(song, groups)
        : sectionsFrame(song, groups, 0);
    }
    return sectionsFrame(SAMPLE_SONG, [], 0);
  }, [sampleSong, isFullSong]);

  const save = () => {
    onSave({
      template: cloneDoc(textLayout(template)),
      background: background ? cloneDoc(background) : null,
    });
    onToggle();
  };

  return (
    <>
      <DialogBody className="flex-1 min-h-0 p-0 overflow-hidden">
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
      </DialogBody>

      <DialogFooter className="px-4 py-3 border-t border-stroke shrink-0">
        <div className="stack-row justify-between w-full">
          <div className="stack-row">{footerStart?.({ setValue })}</div>
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
