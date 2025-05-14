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
  /** The google page objectIds of the presentation */
  pageIds: string[];
  /** Links to the preview images of the presentation  */
  thumbnailLinks: string[];

  html?: string;

  _isFetching?: boolean;
};

export type DisplayMode = "googleslides" | "image";

export type PluginRendererData = {
  slideIndex: number | null;
  clickCount: number | null;
  /**
   * We store this based on what the click returns to us.
   * Used to display on the remote which slide is currently used
   */
  resolvedSlideIndex: number | null;
  /**
   * What mode should we render the slides with.
   * By default, googleslides if nothing is selected
   */
  displayMode?: DisplayMode;
};
