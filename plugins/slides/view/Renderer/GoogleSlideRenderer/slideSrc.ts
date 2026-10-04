/** The proxied Google Slides embed for one import */
export const googleSlideSrc = (pluginId: string, importId: string) =>
  window.location.origin +
  `/plugin/slides/gslide/proxy?pluginId=${pluginId}&importId=${importId}`;
