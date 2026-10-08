import type { MediaListItem, MediaPickerResult } from "@repo/base-types";
import { isImageFile, isVideoFile } from "@repo/lib";
import {
  MediaPreview,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui";
import {
  DragEvent,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LuBan,
  LuChevronDown,
  LuFolderOpen,
  LuPalette,
  LuPlay,
} from "react-icons/lu";

import { paintToCss } from "../../react/css";
import { createLayoutDoc, createShapeElement } from "../../schema/defaults";
import { FillPaint, VIDEO_COVER_WIDTH, solidPaint } from "../../schema/paint";
import { FillSection } from "../inspector/sections/FillSection";
import { LayoutPluginApi } from "../pluginApi";
import { MEDIA_DRAG_TYPE } from "./mediaDrop";
import { mediaMatchesFill, mediaPreviewData } from "./mediaItem";

/** How often to check on media that is still processing */
const PROCESSING_POLL_MS = 3000;

const MEDIA_TYPES: ("image" | "video")[] = ["image", "video"];

const FILTERS = [
  { value: "all", label: "All" },
  { value: "video", label: "Videos" },
  { value: "image", label: "Pictures" },
] as const;
type MediaFilter = (typeof FILTERS)[number]["value"];

const matchesFilter = (item: MediaListItem, filter: MediaFilter) =>
  filter === "all" ||
  (filter === "video"
    ? isVideoFile(item.fileExtension)
    : isImageFile(item.fileExtension));

type ColourFill = Extract<FillPaint, { type: "solid" | "linearGradient" }>;

const isColourFill = (fill: FillPaint | null | undefined): fill is ColourFill =>
  fill?.type === "solid" || fill?.type === "linearGradient";

type MediaStripProps = {
  api: LayoutPluginApi;
  onApply: (picked: MediaPickerResult) => void;
  onNone?: () => void;
  onColour?: (fill: FillPaint) => void;
  /** Marks the current choice */
  selection?: FillPaint | null;
  headerExtras?: ReactNode;
  /** Adds a button that closes the panel */
  onHide?: () => void;
  className?: string;
};

/** The library as a scrolling grid */
export const MediaStrip = ({
  api,
  onApply,
  onNone,
  onColour,
  selection,
  headerExtras,
  onHide,
  className,
}: MediaStripProps) => {
  const [items, setItems] = useState<MediaListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<MediaFilter>("all");

  // Browse awaits the picker, so apply with what is current when it returns
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  const list = api.mediaPicker.list;
  const pluginContext = api.pluginContext;

  const load = useCallback(async () => {
    if (!list) return;
    try {
      setItems(await list({ type: MEDIA_TYPES, pluginContext }));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [list, pluginContext]);

  useEffect(() => {
    void load();
  }, [load]);

  // Check back while anything is processing, so it becomes usable in place
  const processing = !!items?.some(
    (item) => item.processing && item.processing.status !== "FAILED",
  );
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => void load(), PROCESSING_POLL_MS);
    return () => clearInterval(timer);
  }, [processing, load]);

  const browse = async () => {
    const results = await api.mediaPicker.show({
      type: MEDIA_TYPES,
      multiple: false,
      title: "Choose media",
      pluginContext,
    });
    const picked = results?.[0];
    if (picked) onApplyRef.current(picked);
    void load();
  };

  const shown = useMemo(
    () => items?.filter((item) => matchesFilter(item, filter)) ?? null,
    [items, filter],
  );

  return (
    <section
      className={`lay--media-strip flex flex-col min-h-0 ${className ?? ""}`}
      data-testid="layout-media-strip"
      aria-label="Media library"
    >
      <header className="flex flex-wrap items-center gap-2 shrink-0 pb-2">
        <h3 className="text-base font-semibold m-0">Media library</h3>

        <div
          className="lay--media-strip__filters"
          role="tablist"
          aria-label="Filter media"
        >
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              data-active={filter === value ? "" : undefined}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {headerExtras}

        <button
          type="button"
          onClick={() => void browse()}
          className="lay--media-strip__action ml-auto"
          title="Browse or upload media"
        >
          <LuFolderOpen /> Browse
        </button>
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            className="lay--media-strip__action"
            title="Hide media library"
            aria-label="Hide media library"
            data-testid="layout-media-hide"
          >
            <LuChevronDown />
          </button>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="lay--media-strip__grid">
          {onNone && (
            <MediaCard
              label="None"
              active={selection === null}
              onClick={onNone}
              testId="layout-media-none"
              plain
            >
              <span className="lay--media-strip__label">
                <LuBan className="size-5" />
                <span className="text-xs">None</span>
              </span>
            </MediaCard>
          )}
          {onColour && (
            <ColourCard
              current={isColourFill(selection) ? selection : null}
              onChange={onColour}
            />
          )}
          {shown?.map((item) => (
            <MediaCard
              key={item.id}
              label={item.originalName ?? item.mediaName}
              active={!!selection && mediaMatchesFill(item, selection)}
              disabled={!!item.processing}
              onClick={() => onApply(item)}
              testId="layout-media-item"
              onDragStart={(e) => {
                e.dataTransfer.setData(MEDIA_DRAG_TYPE, JSON.stringify(item));
                e.dataTransfer.effectAllowed = "copy";
              }}
            >
              <MediaStill item={item} />
            </MediaCard>
          ))}
        </div>

        {failed ? (
          <p className="text-xs text-secondary py-1">Couldn't load media.</p>
        ) : shown === null ? (
          <p className="text-xs text-secondary py-1">Loading media…</p>
        ) : shown.length === 0 ? (
          <p className="text-xs text-secondary py-1">
            {items?.length
              ? "Nothing of this kind yet."
              : "No pictures or videos yet. Browse to upload some."}
          </p>
        ) : null}
      </div>
    </section>
  );
};

/** As the template rail's cards */
const cardClass = (active: boolean) =>
  `lay--media-strip__item block w-full rounded-sm border cursor-pointer transition-colors ${
    active
      ? "border-primary ring-1 ring-primary"
      : "border-stroke hover:border-primary"
  }`;

const onActivateKey = (action: () => void) => (e: KeyboardEvent) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  action();
};

const MediaCard = ({
  label,
  active,
  disabled = false,
  onClick,
  onDragStart,
  testId,
  plain = false,
  children,
}: {
  label: string;
  active: boolean;
  /** Not usable yet, e.g. still processing */
  disabled?: boolean;
  onClick: () => void;
  onDragStart?: (e: DragEvent) => void;
  testId: string;
  plain?: boolean;
  children: ReactNode;
}) => (
  <div
    role="button"
    tabIndex={disabled ? -1 : 0}
    aria-disabled={disabled || undefined}
    draggable={!!onDragStart && !disabled}
    onDragStart={disabled ? undefined : onDragStart}
    onClick={disabled ? undefined : onClick}
    onKeyDown={disabled ? undefined : onActivateKey(onClick)}
    className={cardClass(active)}
    data-active={active ? "" : undefined}
    data-disabled={disabled ? "" : undefined}
    aria-pressed={active}
    title={label}
    aria-label={label}
    data-testid={testId}
  >
    <span
      className="lay--media-strip__frame"
      data-plain={plain ? "" : undefined}
    >
      {children}
    </span>
  </div>
);

const DEFAULT_COLOUR = solidPaint("#000000");

const ColourCard = ({
  current,
  onChange,
}: {
  current: ColourFill | null;
  onChange: (fill: FillPaint) => void;
}) => {
  const [open, setOpen] = useState(false);
  // What to switch back to after picking media
  const [last, setLast] = useState<ColourFill>(current ?? DEFAULT_COLOUR);
  useEffect(() => {
    if (current) setLast(current);
  }, [current]);

  const shown = current ?? last;
  const element = useMemo(
    () => createShapeElement({ id: "colour", fill: shown }),
    [shown],
  );
  const doc = useMemo(
    () => createLayoutDoc({ elements: [element] }),
    [element],
  );

  const select = () => {
    if (!current) onChange(last);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className={cardClass(!!current)}
          data-active={current ? "" : undefined}
          aria-pressed={!!current}
          title="Colour"
          aria-label="Colour"
          data-testid="layout-media-colour"
          onClick={select}
          onKeyDown={onActivateKey(() => {
            select();
            setOpen(true);
          })}
        >
          <span className="lay--media-strip__frame" data-plain="">
            <span
              className="lay--media-strip__swatch"
              style={{ background: paintToCss(shown) }}
            />
            <span className="lay--media-strip__label lay--media-strip__label--on-swatch">
              <LuPalette className="size-5" />
              <span className="text-xs">Colour</span>
            </span>
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        avoidCollisions={false}
        className="w-72 max-h-[var(--radix-popover-content-available-height)] overflow-y-auto"
        data-testid="layout-media-colour-panel"
        hideCloseButton
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <FillSection
          bare
          doc={doc}
          element={element}
          title="Colour"
          only={["solid", "linearGradient"]}
          onChange={(next) => {
            const fill = next.elements[0]?.fill;
            if (!isColourFill(fill)) return;
            setLast(fill);
            onChange(fill);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

const MediaStill = ({ item }: { item: MediaListItem }) => (
  <>
    <MediaPreview
      media={mediaPreviewData(item)}
      imageWidth={VIDEO_COVER_WIDTH}
      loading="lazy"
    />
    {isVideoFile(item.fileExtension) && (
      <LuPlay className="lay--media-strip__badge" />
    )}
  </>
);
