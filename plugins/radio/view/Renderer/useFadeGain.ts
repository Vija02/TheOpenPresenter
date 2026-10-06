import { useEffect, useReducer } from "react";

import { SequenceFade } from "../../src/sequence";

const STEP_MS = 50;

/** Volume along an equal power curve, so the mix doesn't dip midway */
export const useFadeGain = (
  fade: SequenceFade | null,
  direction: "in" | "out",
) => {
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!fade) return;
    const interval = setInterval(() => {
      rerender();
      if (Date.now() >= fade.endsAt) clearInterval(interval);
    }, STEP_MS);
    return () => clearInterval(interval);
  }, [fade]);

  if (!fade) return 1;

  const progress = Math.min(
    1,
    Math.max(0, (Date.now() - fade.startsAt) / (fade.endsAt - fade.startsAt)),
  );
  return direction === "in"
    ? Math.sin((progress * Math.PI) / 2)
    : Math.cos((progress * Math.PI) / 2);
};
