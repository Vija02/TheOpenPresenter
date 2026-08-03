import { findFontOption } from "../../fonts/registry";

let generation = 0;
const listeners = new Set<() => void>();
/** Families already handed to `document.fonts.load`, so we ask at most once. */
const requested = new Set<string>();
let listening = false;

export const getFontGeneration = (): number => generation;

/** Stable snapshot for SSR, where no font ever loads. */
export const getServerFontGeneration = (): number => 0;

const bump = () => {
  generation += 1;
  for (const listener of listeners) listener();
};

/**
 * Load the bundled faces used by the given font stacks, and bump the
 * generation when they land
 */
export const ensureFontsLoaded = (stacks: Iterable<string>): void => {
  if (typeof document === "undefined" || !document.fonts) return;

  if (!listening) {
    listening = true;
    document.fonts.addEventListener("loadingdone", bump);
  }

  const pending: Promise<unknown>[] = [];
  for (const stack of stacks) {
    const option = findFontOption(stack);
    // System entries and unknown families have nothing to fetch.
    if (option?.source !== "bundled" || !option.family) continue;
    if (requested.has(option.family)) continue;
    requested.add(option.family);
    pending.push(
      document.fonts.load(`1em "${option.family}"`).catch(() => undefined),
    );
  }

  if (pending.length === 0) return;
  void Promise.allSettled(pending).then(bump);
};

export const subscribeToFonts = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
