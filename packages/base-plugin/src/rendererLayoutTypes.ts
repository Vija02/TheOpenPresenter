import type { Derivation } from "@repo/base-types";

/**
 * A screen's custom layout from before outputs. Still read, by `readOutputs`
 * in @repo/layout, for projects that have no outputs yet
 */
export type RendererLayout<Doc = unknown> = {
  enabled: boolean;
  doc: Doc;
};

export type { Derivation };

export type OutputData<Doc = any> = {
  name: string;
  layout: Doc;
};

export {
  BUILT_IN_LOOK_KEYS,
  CONFIDENCE_LOOK_KEY,
  MAIN_LOOK_KEY,
  OVERLAY_LOOK_KEY,
} from "@repo/base-types";
export type { PluginLook, ProjectLook, ProjectLooks } from "@repo/base-types";
