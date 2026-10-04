import type { InkStroke } from "../../src/ink";

/**
 * Ink that only exists while the speaker is drawing: the laser trail, and a
 * pencil/highlight stroke before it is finished. It travels through awareness
 * (ephemeral, per client) instead of renderer data, so it never piles up in
 * the document and disappears if the speaker's device drops.
 */
export type LiveInk = {
  slideRef: string;
  /** The laser trail, oldest point first: flat `[x, y, pressure, ...]` */
  laser?: number[];
  /** A stroke being drawn */
  stroke?: InkStroke;
};

export const liveInkFieldKey = (pluginId: string) => `slidesInk:${pluginId}`;

/** Every client's live ink on `slideRef`, the local one included */
export const liveInkOn = (
  awarenessData: Record<string, unknown>[],
  pluginId: string,
  slideRef: string,
): LiveInk[] => {
  const key = liveInkFieldKey(pluginId);
  return awarenessData
    .map((state) => state?.[key] as LiveInk | null | undefined)
    .filter((ink): ink is LiveInk => !!ink && ink.slideRef === slideRef);
};
