import { LAYOUT_VIDEO_STATES_KEY, VIDEO_VOLUME_KEY } from "@repo/base-types";
import { type LayoutDoc, type LayoutVideoStates } from "@repo/layout";

export type ImportType =
  | "googleslides"
  | "canva"
  | "pdf"
  | "ppt"
  | "image"
  | "custom";
export type DisplayMode = "googleslides" | "image" | "layout";

/**
 * Default display mode for each import type.
 * Used when an import has no explicit override in renderer's `displayModes`.
 */
export const DEFAULT_DISPLAY_MODE_BY_TYPE: Record<ImportType, DisplayMode> = {
  googleslides: "googleslides",
  canva: "image",
  pdf: "image",
  ppt: "image",
  image: "image",
  custom: "layout",
};

export const getEffectiveDisplayMode = (
  importData: ImportData,
  displayModes: Record<string, DisplayMode> | undefined,
): DisplayMode =>
  displayModes?.[importData.importId] ??
  DEFAULT_DISPLAY_MODE_BY_TYPE[importData.type];

/**
 * Base import data - all imports have these properties
 */
export interface BaseImportData {
  /** Unique ID for this import */
  importId: string;
  /** Human-readable name for this import */
  name?: string;
  /** Used to detect when data changes (e.g., when we refetch) */
  fetchId: string;
  /** Type of import */
  type: ImportType;
  /** Links to the preview images, indexed by slide index within this import */
  thumbnailLinks: string[];
  /**
   * The number of clicks/animations per slide within this import.
   * Index corresponds to slide index, value is the click count for that slide.
   * A value of 0 means no animations (just show slide, then move to next).
   */
  slideClickCounts: number[];
  /**
   * Stable IDs for each slide within this import.
   * For Google Slides: extracted Google ObjectIds.
   * For PDF/PPT: generated at import time (e.g., "0", "1", "2").
   */
  slideIds: string[];
  /** Media name of the PDF that was uploaded as part of this import */
  pdfMediaName?: string;
  /** Whether this import is currently being fetched/processed */
  _isFetching?: boolean;
  /** If replacing an existing import, shows the id */
  replaceImportId?: string;
}

export interface GoogleSlidesImportData extends BaseImportData {
  type: "googleslides";
  /** The Google presentation objectId */
  presentationId: string;
  /** Processed HTML for rendering slides */
  html: string;
  /** Similar to slideClickCounts but for slide transition duration */
  slideTransitionDurations?: number[];
  /** Similar to slideClickCounts but for each slide's on-click step durations */
  slideClickDurations?: number[][];
  /** Similar to slideClickCounts but to indicate if there's an element that plays directly. 0 means none */
  slideAutoplayDurations?: number[];
}

export interface CanvaImportData extends BaseImportData {
  type: "canva";
  designId: string;
  connectionId?: string;
}

export interface PdfImportData extends BaseImportData {
  type: "pdf";
}

export interface PptImportData extends BaseImportData {
  type: "ppt";
}

export interface ImageImportData extends BaseImportData {
  type: "image";
}

export interface CustomImportData extends BaseImportData {
  type: "custom";
  docs: LayoutDoc[];
}

export type ImportData =
  | GoogleSlidesImportData
  | CanvaImportData
  | PdfImportData
  | PptImportData
  | ImageImportData
  | CustomImportData;

// ============================================================================
// Plugin Data Types
// ============================================================================

/**
 * Main plugin data stored in Yjs
 */
export type PluginBaseData = {
  /** Map of importId -> ImportData */
  imports: Record<string, ImportData>;

  /**
   * Ordered list of slide references in format "importId:slideIndex"
   */
  slideOrder: string[];
};

// ============================================================================
// Renderer Data Types
// ============================================================================

export type AutoplayState = {
  /**
   * Indicates whether autoplay behaviour is enabled for the renderer.
   */
  enabled: boolean;
  /**
   * The duration (in milliseconds) between slide transitions while autoplay is enabled.
   */
  loopDurationMs: number;
};

export type PluginRendererData = {
  currentSlideIndex: number | null;
  currentClickCount: number | null;
  /** When should the current transition ends so we can calculate what to do on next */
  transitionEndsAt?: number;
  /** Track this so we can apply specific behavior */
  isTransitioningBackwards?: boolean;
  /**
   * Epoch timestamp (in milliseconds) of when the slide was last clicked.
   * Used to calculate things like autoplay without relying on timers.
   */
  lastClickTimestamp: number | null;
  /**
   * Autoplay configuration
   */
  autoplay?: AutoplayState;
  /**
   * Per-import display mode, keyed by importId.
   */
  displayModes?: Record<string, DisplayMode>;

  [LAYOUT_VIDEO_STATES_KEY]?: LayoutVideoStates;
  [VIDEO_VOLUME_KEY]?: number;
};

// ============================================================================
// Helper Types
// ============================================================================

export interface SlideReference {
  importId: string;
  slideIndex: number;
}

export interface ResolvedSlide {
  importData: ImportData;
  rawRef: string;
  ref: SlideReference;
  globalSlideIndex: number;
  localSlideIndex: number;
  thumbnailUrl: string;
  clickCount: number;
}
