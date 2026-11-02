/**
 * A look is how a plugin's content shows for one purpose
 */

// Some hardcoded stuff
export const MAIN_LOOK_KEY = "main";
export const CONFIDENCE_LOOK_KEY = "confidence";
export const OVERLAY_LOOK_KEY = "overlay";

export const BUILT_IN_LOOK_KEYS: { key: string; name: string }[] = [
  { key: MAIN_LOOK_KEY, name: "Main" },
  { key: CONFIDENCE_LOOK_KEY, name: "Confidence monitor" },
  { key: OVERLAY_LOOK_KEY, name: "Overlay" },
];

/**
 * One of a plugin's styles for a look. A plugin can have several for each:
 * the first is the one it shows unless a project picks another
 */
export type PluginLook<Doc = unknown> = {
  /** The look it is for, eg. confidence */
  key: string;
  name: string;
  doc: Doc;
  /** Tells a plugin's styles for one look apart. Defaults to "default" */
  style?: string;
};

export const DEFAULT_STYLE = "default";

/**
 * The colours plugins' samples share, so a look's previews sit together.
 * TheOpenPresenter's own: theopenpresenter.com's dark grey and teal
 */
export const SAMPLE_COLORS = {
  background: "#1d1d20",
  surface: "#2e2e33",
  line: "#3f3f45",
  text: "#f4f4f5",
  muted: "#a2a2a8",
  accent: "#3abab4",
  accentDark: "#285e61",
} as const;

/** Made-up content for preview */
export type PluginSample = {
  pluginData?: Record<string, unknown>;
  rendererData?: Record<string, unknown>;
  /** A picture shown in the plugin's place */
  image?: string;
};

export type ProjectLook<Doc = unknown> = {
  /** By plugin name. A plugin missing here shows its built-in version */
  plugins: Record<string, Doc>;
  /** For a project's own look, eg. a second confidence monitor's */
  name?: string | null;
  /** A project's own look shows this look for plugins it hasn't changed */
  base?: string | null;
  /** The style picked for each plugin, by plugin name */
  styles?: Record<string, string> | null;
  /** Turned off: not offered when picking a screen's look */
  hidden?: boolean | null;
};

export type ProjectLooks<Doc = unknown> = Record<string, ProjectLook<Doc>>;
