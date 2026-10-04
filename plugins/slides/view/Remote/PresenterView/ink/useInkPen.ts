import { useCallback, useEffect, useRef } from "react";

import {
  INK_COLORS,
  type InkStroke,
  type InkTool,
  roundInk,
} from "../../../../src/ink";
import { type LiveInk, liveInkFieldKey } from "../../../Ink/liveInk";
import { usePluginAPI } from "../../../pluginApi";

/** How long the laser trail lingers behind the pointer */
const LASER_TAIL_MS = 500;
/** Live ink goes out at most this often; every renderer redraws on each */
const PUBLISH_INTERVAL_MS = 33;

type TimedPoint = { x: number; y: number; pressure: number; at: number };

export type InkPoint = { x: number; y: number; pressure: number };

/**
 * Draws with `tool` on `slideRef`. Feed it pointer positions as fractions of
 * the slide box. The laser and an unfinished stroke are shared through
 * awareness; a finished stroke is kept in renderer data.
 */
export const useInkPen = ({
  tool,
  slideRef,
}: {
  tool: InkTool;
  slideRef: string | null;
}) => {
  const pluginApi = usePluginAPI();
  const mutableRendererData = pluginApi.renderer.useValtioData();
  const { awarenessObj } = pluginApi.awareness;
  const fieldKey = liveInkFieldKey(pluginApi.pluginContext.pluginId);

  const strokeRef = useRef<InkStroke | null>(null);
  const strokeSlideRef = useRef<string | null>(null);
  const laserRef = useRef<TimedPoint[]>([]);
  const laserDownRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const lastPublishRef = useRef(0);
  const dirtyRef = useRef(false);

  const publish = useCallback(
    (live: LiveInk | null) => {
      awarenessObj.setLocalStateField(fieldKey, live);
      lastPublishRef.current = performance.now();
      dirtyRef.current = false;
    },
    [awarenessObj, fieldKey],
  );

  const liveNow = useCallback((): LiveInk | null => {
    const ref = strokeSlideRef.current;
    if (!ref) return null;
    const laser = laserRef.current;
    const stroke = strokeRef.current;
    if (laser.length === 0 && !stroke) return null;
    return {
      slideRef: ref,
      ...(laser.length > 0 && {
        laser: laser.flatMap((p) => [p.x, p.y, p.pressure]),
      }),
      ...(stroke && { stroke }),
    };
  }, []);

  // One loop while anything is live: ages the laser trail and sends updates
  // no more often than PUBLISH_INTERVAL_MS
  const tick = useCallback(() => {
    frameRef.current = null;
    const now = performance.now();

    const laser = laserRef.current;
    const keepFrom = now - LASER_TAIL_MS;
    let drop = 0;
    while (drop < laser.length && laser[drop]!.at < keepFrom) drop++;
    // While pressed, the head stays even when the pointer holds still
    if (laserDownRef.current) drop = Math.min(drop, laser.length - 1);
    if (drop > 0) {
      laser.splice(0, drop);
      dirtyRef.current = true;
    }

    if (
      dirtyRef.current &&
      now - lastPublishRef.current >= PUBLISH_INTERVAL_MS
    ) {
      publish(liveNow());
    }

    const live =
      laser.length > 0 || strokeRef.current !== null || dirtyRef.current;
    if (live) frameRef.current = requestAnimationFrame(tick);
  }, [liveNow, publish]);

  const schedule = useCallback(() => {
    dirtyRef.current = true;
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const begin = useCallback(
    (point: InkPoint, hasPressure: boolean) => {
      if (!slideRef) return;
      strokeSlideRef.current = slideRef;
      const now = performance.now();
      if (tool === "laser") {
        laserDownRef.current = true;
        laserRef.current.push({ ...rounded(point), at: now });
      } else {
        const { x, y, pressure } = rounded(point);
        strokeRef.current = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          tool,
          color: INK_COLORS[tool],
          points: [x, y, pressure],
          hasPressure,
        };
      }
      schedule();
    },
    [slideRef, tool, schedule],
  );

  const move = useCallback(
    (point: InkPoint) => {
      const { x, y, pressure } = rounded(point);
      if (laserDownRef.current) {
        laserRef.current.push({ x, y, pressure, at: performance.now() });
        schedule();
      } else if (strokeRef.current) {
        strokeRef.current = {
          ...strokeRef.current,
          points: [...strokeRef.current.points, x, y, pressure],
        };
        schedule();
      }
    },
    [schedule],
  );

  const end = useCallback(() => {
    // The laser trail fades out on its own
    laserDownRef.current = false;

    const stroke = strokeRef.current;
    const ref = strokeSlideRef.current;
    strokeRef.current = null;
    if (stroke && ref) {
      if (!mutableRendererData.ink) mutableRendererData.ink = {};
      const ink = mutableRendererData.ink;
      if (ink[ref]) ink[ref].push(stroke);
      else ink[ref] = [stroke];
    }
    schedule();
  }, [mutableRendererData, schedule]);

  // Stop sharing anything live when the speaker view closes
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      laserRef.current = [];
      strokeRef.current = null;
      awarenessObj.setLocalStateField(fieldKey, null);
    },
    [awarenessObj, fieldKey],
  );

  return { begin, move, end };
};

const rounded = ({ x, y, pressure }: InkPoint): InkPoint => ({
  x: roundInk(x),
  y: roundInk(y),
  pressure: roundInk(pressure),
});
