import type { Derivation } from "@repo/base-types";

/** A screen's custom layout, used for confidence monitors and multi-pane output */
export type RendererLayout<Doc = unknown> = {
  enabled: boolean;
  doc: Doc;
};

export type { Derivation };
