import { useMemo, useRef } from "react";

import { Outputs, readOutputs } from "../doc/outputs";

type OutputsState = Parameters<typeof readOutputs>[0];

export const useReadOutputs = (state: OutputsState): Outputs => {
  const ids = Object.keys(state.renderer ?? {}).sort();
  const inputs = [
    state.outputs ?? null,
    ...ids,
    ...ids.map((id) => state.renderer[id]?.layout ?? null),
  ];

  const last = useRef<unknown[]>([]);
  const same =
    last.current.length === inputs.length &&
    last.current.every((value, i) => value === inputs[i]);
  if (!same) last.current = inputs;

  const key = last.current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readOutputs(state), [key]);
};
