import { useEffect, useMemo, useState } from "react";

import {
  SequenceAnchor,
  SequenceItem,
  SequenceOptions,
  resolveSequence,
} from "../../src/sequence";

// Land just past a boundary rather than just before it
const BOUNDARY_SLACK_MS = 50;
// setTimeout fires straight away past ~24.8 days, so long waits go in steps
const MAX_TIMEOUT_MS = 60 * 60 * 1000;

/** Handle going to the next item in sequence */
export const useResolvedSequence = (
  items: SequenceItem[],
  anchor: SequenceAnchor,
  { repeat, crossfade }: SequenceOptions,
) => {
  const [tick, setTick] = useState(0);

  const resolved = useMemo(
    () => resolveSequence(items, anchor, { repeat, crossfade }, Date.now()),
    // tick is how we ask for a fresh Date.now()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, anchor, repeat, crossfade, tick],
  );

  useEffect(() => {
    if (resolved.nextChangeAt === null) return;

    const timeout = setTimeout(
      () => setTick((x) => x + 1),
      Math.min(
        Math.max(0, resolved.nextChangeAt - Date.now()) + BOUNDARY_SLACK_MS,
        MAX_TIMEOUT_MS,
      ),
    );
    return () => clearTimeout(timeout);
    // On tick too, so a timer that fired early (eg. the clock moved) waits again
  }, [resolved.nextChangeAt, tick]);

  // Background tabs and sleeping devices hold timers back, so catch up on return
  useEffect(() => {
    const catchUp = () => {
      if (document.visibilityState === "visible") setTick((x) => x + 1);
    };
    document.addEventListener("visibilitychange", catchUp);
    window.addEventListener("focus", catchUp);
    return () => {
      document.removeEventListener("visibilitychange", catchUp);
      window.removeEventListener("focus", catchUp);
    };
  }, []);

  return resolved;
};
