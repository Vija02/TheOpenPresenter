import { desktop } from "@repo/desktop-bridge";

import { usePresentedOnKeys } from "./presentedOn";
import { useOutputName } from "./useOutputName";
import { useOutputPresences } from "./useOutputPresences";
import { usePresentStatus } from "./usePresentStatus";

/** displayKey() → output names */
export const useShowingOnDisplays = (): Record<string, string[]> => {
  const nameOf = useOutputName();
  const { presences } = useOutputPresences();
  const { displayOutputIds } = usePresentStatus();
  const monitorKeys = usePresentedOnKeys();

  const showing: Record<string, Set<string>> = {};
  const add = (key: string | null | undefined, outputId: string) => {
    if (!key) return;
    (showing[key] ??= new Set()).add(nameOf(outputId));
  };

  // Only this computer's displays
  for (const p of presences) {
    if (!p.isLocal) continue;
    if (p.where === "studio" || p.where === "window" || p.where === "tab") {
      add(p.screenKey, p.outputId);
    }
  }
  if (desktop.isDesktop) {
    for (const outputId of displayOutputIds)
      add(monitorKeys[outputId], outputId);
  }

  return Object.fromEntries(
    Object.entries(showing).map(([name, set]) => [name, [...set]]),
  );
};
