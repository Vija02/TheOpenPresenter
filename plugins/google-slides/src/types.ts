export type PluginBaseData = {
  /** The google presentation objectId */
  presentationId: string;
  /** The google page objectIds of the presentation */
  pageIds: string[];
  /** Links to the preview images of the presentation  */
  thumbnailLinks: string[];

  html?: string
};

export type PluginRendererData = {
  slideIndex: number | null;
};
