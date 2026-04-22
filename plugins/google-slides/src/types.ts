export type ImportType = "googleslides" | "pdf" | "ppt";

export type PluginBaseData = {
  /**
   * An ID generated whenever we fetch the data.
   * We use this as a key to know when the data changes (eg: When we refetch the data)
   */
  fetchId: string | null;

  /**
   * The type of file imported
   * By default, googleslides
   */
  type?: ImportType;

  /** The google presentation objectId */
  presentationId: string;
  /**
   * The number of clicks/animations per slide.
   * Index corresponds to slide index, value is the click count for that slide.
   * A value of 0 means no animations (just show slide, then move to next).
   */
  slideClickCounts: number[];
  /** Links to the preview images of the presentation  */
  thumbnailLinks: string[];

  html?: string;

  _isFetching?: boolean;
};

export type DisplayMode = "googleslides" | "image";

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
  slideIndex: number | null;
  clickCount: number | null;
  /**
   * What mode should we render the slides with.
   * By default, googleslides if nothing is selected
   */
  displayMode?: DisplayMode;
  /**
   * Epoch timestamp (in milliseconds) of when the slide is clicked
   * Used to calculate things like autoplay without relying on timers.
   */
  lastClickTimestamp: number | null;
  /**
   * Image renderer autoplay configuration.
   */
  autoplay?: AutoplayState;
};
