export type PluginBaseData = {
  // The event hash or join code, without the leading "#"
  eventCode: string | null;
  // Room id, taken from the `section` query param of a room link
  section: string | null;
};

export type PluginRendererData = {};
