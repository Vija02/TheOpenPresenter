import { useCallback, useEffect, useMemo, useState } from "react";

import type { ImportData } from "../../../src/types";
import type { Scene } from "./HeldScene";

// Longest a replaced deck stays up while the new one loads
const MAX_HOLD_MS = 15_000;

export type LoadingReporters = {
  onLoadingChange: (id: string, isLoading: boolean) => void;
  onUnmount: (id: string) => void;
};

export type Layer = {
  key: number;
  /** The scene it's frozen on, or null to follow the live one */
  scene: Scene | null;
  hidden: boolean;
  reporters: LoadingReporters;
};

/** A deck replaced its import, and the new one is ready to draw */
const wasReplaced = (
  before: Record<string, ImportData>,
  after: Record<string, ImportData>,
) =>
  Object.values(after).some(
    (imp) =>
      !imp._isFetching &&
      !!imp.replaceImportId &&
      !!before[imp.replaceImportId] &&
      !after[imp.replaceImportId],
  );

type Hold = {
  /** Bumped by each replace, so the new deck gets a fresh layer */
  layer: number;
  /** The layer still showing the replaced deck, and the scene it shows */
  held: { layer: number; scene: Scene } | null;
};

/**
 * Keeps a replaced deck on screen until its replacement has loaded, rather
 * than the screen going blank while it does. Loading counts only the layer
 * that will show.
 */
export const useReplaceHold = (scene: Scene) => {
  const [hold, setHold] = useState<Hold>({ layer: 0, held: null });
  const [prevScene, setPrevScene] = useState(scene);
  if (scene !== prevScene) {
    setPrevScene(scene);
    if (wasReplaced(prevScene.pluginData.imports, scene.pluginData.imports)) {
      setHold((h) => ({
        layer: h.layer + 1,
        held: h.held ?? { layer: h.layer, scene: prevScene },
      }));
    }
  }
  const release = useCallback(() => setHold((h) => ({ ...h, held: null })), []);

  // Keyed `${layer}:${id}`
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const reportersFor = useCallback(
    (layer: number): LoadingReporters => ({
      onLoadingChange: (id, isLoading) =>
        setLoadingMap((prev) =>
          prev[`${layer}:${id}`] === isLoading
            ? prev
            : { ...prev, [`${layer}:${id}`]: isLoading },
        ),
      onUnmount: (id) =>
        setLoadingMap((prev) => {
          if (!(`${layer}:${id}` in prev)) return prev;
          const { [`${layer}:${id}`]: _, ...rest } = prev;
          return rest;
        }),
    }),
    [],
  );
  const liveReporters = useMemo(
    () => reportersFor(hold.layer),
    [reportersFor, hold.layer],
  );
  const heldLayer = hold.held?.layer;
  const heldReporters = useMemo(
    () => (heldLayer === undefined ? null : reportersFor(heldLayer)),
    [reportersFor, heldLayer],
  );

  const prefix = `${hold.layer}:`;
  const isLoading = Object.entries(loadingMap).some(
    ([key, loading]) => loading && key.startsWith(prefix),
  );
  const isHolding = !!hold.held;

  // The new layer's renderers report in their first effects, which land
  // together with this
  const [settledLayer, setSettledLayer] = useState(hold.layer);
  useEffect(() => setSettledLayer(hold.layer), [hold.layer]);

  useEffect(() => {
    if (isHolding && settledLayer === hold.layer && !isLoading) release();
  }, [isHolding, settledLayer, hold.layer, isLoading, release]);

  // Restarts for each replace, so the newest deck gets the full time
  useEffect(() => {
    if (!isHolding) return;
    const timer = setTimeout(release, MAX_HOLD_MS);
    return () => clearTimeout(timer);
  }, [isHolding, hold.layer, release]);

  // Forget what old layers reported once they're gone
  useEffect(() => {
    if (isHolding) return;
    setLoadingMap((prev) => {
      const kept = Object.entries(prev).filter(([key]) =>
        key.startsWith(prefix),
      );
      return kept.length === Object.keys(prev).length
        ? prev
        : Object.fromEntries(kept);
    });
  }, [isHolding, prefix]);

  const layers: Layer[] = [];
  if (hold.held && heldReporters) {
    layers.push({
      key: hold.held.layer,
      scene: hold.held.scene,
      hidden: false,
      reporters: heldReporters,
    });
  }
  layers.push({
    key: hold.layer,
    scene: null,
    hidden: isHolding,
    reporters: liveReporters,
  });

  return { layers, isLoading };
};
