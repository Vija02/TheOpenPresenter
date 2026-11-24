import {
  findFontOption,
  getOrganizationFonts,
  reportMissingFont,
  subscribeToFontOptions,
} from "@repo/layout";

let generation = 0;
let listening = false;
const listeners = new Set<() => void>();
/** Families already handed to `document.fonts.load`, so we ask at most once. */
const requested = new Set<string>();
const wanted = new Set<string>();
const stylesheets = new Map<string, Promise<boolean>>();

export const getFontGeneration = (): number => generation;

/** Stable snapshot for SSR, where no font ever loads. */
export const getServerFontGeneration = (): number => 0;

const bump = () => {
  generation += 1;
  for (const listener of listeners) listener();
};

const injectStylesheet = (cssUrl: string): Promise<boolean> => {
  const existing = stylesheets.get(cssUrl);
  if (existing) return existing;
  const ready = new Promise<boolean>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    link.dataset.layoutFont = cssUrl;
    link.onload = () => resolve(true);
    link.onerror = () => {
      // Let a later call retry, eg once the network is back
      link.remove();
      stylesheets.delete(cssUrl);
      resolve(false);
    };
    document.head.appendChild(link);
  });
  stylesheets.set(cssUrl, ready);
  return ready;
};

const injectOrganizationStylesheets = () => {
  for (const font of getOrganizationFonts()) {
    if (font.cssUrl) void injectStylesheet(font.cssUrl);
  }
};

const startListening = () => {
  if (listening) return;
  listening = true;
  document.fonts.addEventListener("loadingdone", bump);
  injectOrganizationStylesheets();
  subscribeToFontOptions(() => {
    injectOrganizationStylesheets();
    ensureFontsLoaded([...wanted]);
    bump();
  });
};

/**
 * Load the bundled and organization faces used by the given font stacks, and
 * bump the generation when they land
 */
export const ensureFontsLoaded = (stacks: Iterable<string>): void => {
  if (typeof document === "undefined" || !document.fonts) return;
  startListening();

  const pending: Promise<unknown>[] = [];
  for (const stack of stacks) {
    wanted.add(stack);
    const option = findFontOption(stack);
    if (!option) {
      reportMissingFont(stack);
      continue;
    }
    if (!option.family || option.source === "system") continue;
    if (requested.has(option.family)) continue;
    requested.add(option.family);
    const family = option.family;
    const before = option.cssUrl
      ? injectStylesheet(option.cssUrl)
      : Promise.resolve(true);
    pending.push(
      before
        .then((ok) => {
          if (ok) return document.fonts.load(`1em "${family}"`);
          requested.delete(family);
        })
        .catch(() => undefined),
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
