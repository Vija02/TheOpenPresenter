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

/** A plugin's version of a look */
export type PluginLook<Doc = unknown> = {
  key: string;
  name: string;
  doc: Doc;
};

export type ProjectLook<Doc = unknown> = {
  /** By plugin name. A plugin missing here shows its built-in version */
  plugins: Record<string, Doc>;
};

export type ProjectLooks<Doc = unknown> = Record<string, ProjectLook<Doc>>;
