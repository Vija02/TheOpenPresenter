export type PluginBaseData = {
  /** The google presentation objectId */
  presentationId: string;
  /** The google page objectIds of the presentation */
  pageIds: string[];
  /** Links to the preview images of the presentation  */
  thumbnailLinks: string[];

  html?: string;
};

export type PluginRendererData = {
  slideIndex: number | null;
  clickCount: number | null;
  /** 
   * We store this based on what the click returns to us.
   * Used to display on the remote which slide is currently used
   */
  resolvedSlideIndex: number | null
};
