export type FontSource = "bundled" | "organization" | "system";

export type FontCategory = "sans" | "serif" | "display" | "mono";

export type FontOption = {
  id: string;
  label: string;
  /** The value written into `style.fontFamily`. */
  stack: string;
  source: FontSource;
  category: FontCategory;
  family?: string;
  cssUrl?: string;
};

/**
 * Bundled through `@fontsource-variable`
 */
export const BUNDLED_FONTS: FontOption[] = [
  {
    id: "inter",
    label: "Inter",
    family: "Inter Variable",
    stack: '"Inter Variable", system-ui, sans-serif',
    source: "bundled",
    category: "sans",
  },
  {
    id: "source-sans-3",
    label: "Source Sans 3",
    family: "Source Sans 3 Variable",
    stack: '"Source Sans 3 Variable", system-ui, sans-serif',
    source: "bundled",
    category: "sans",
  },
  {
    id: "open-sans",
    label: "Open Sans",
    family: "Open Sans Variable",
    stack: '"Open Sans Variable", system-ui, sans-serif',
    source: "bundled",
    category: "sans",
  },
  {
    id: "montserrat",
    label: "Montserrat",
    family: "Montserrat Variable",
    stack: '"Montserrat Variable", system-ui, sans-serif',
    source: "bundled",
    category: "display",
  },
  {
    id: "oswald",
    label: "Oswald",
    family: "Oswald Variable",
    stack: '"Oswald Variable", "Arial Narrow", sans-serif',
    source: "bundled",
    category: "display",
  },
  {
    id: "playfair-display",
    label: "Playfair Display",
    family: "Playfair Display Variable",
    stack: '"Playfair Display Variable", Georgia, serif',
    source: "bundled",
    category: "serif",
  },
];

export const SYSTEM_FONTS: FontOption[] = [
  {
    id: "arial",
    label: "Arial",
    stack: "Arial, sans-serif",
    source: "system",
    category: "sans",
  },
  {
    id: "times-new-roman",
    label: "Times New Roman",
    stack: '"Times New Roman", Times, serif',
    source: "system",
    category: "serif",
  },
  {
    id: "courier-new",
    label: "Courier New",
    stack: '"Courier New", Courier, monospace',
    source: "system",
    category: "mono",
  },
];

/** Without organization fonts; see `getFontOptions`. */
export const FONT_OPTIONS: FontOption[] = [...BUNDLED_FONTS, ...SYSTEM_FONTS];

export type OrganizationFont = {
  family: string;
  category: string;
  cssUrl: string;
};

const FALLBACK_BY_CATEGORY: Record<FontCategory, string> = {
  sans: "system-ui, sans-serif",
  serif: "Georgia, serif",
  display: "system-ui, sans-serif",
  mono: '"Courier New", monospace',
};

const isCategory = (c: string): c is FontCategory => c in FALLBACK_BY_CATEGORY;

export const organizationFontStack = (family: string, category: string) =>
  `"${family.replace(/["\\]/g, "")}", ${
    FALLBACK_BY_CATEGORY[isCategory(category) ? category : "sans"]
  }`;

// One copy for every entry: `react` and `editor` import this as `@repo/layout`
const state = {
  organizationFonts: [] as FontOption[],
  fontOptions: FONT_OPTIONS,
  listeners: new Set<() => void>(),
  addFontHandler: null as AddFontHandler | null,
};

const notify = () => {
  for (const listener of state.listeners) listener();
};

export const setOrganizationFonts = (fonts: OrganizationFont[]): void => {
  // Two instances can add the same family before they sync
  const seen = new Set<string>();
  const unique = fonts.filter((f) => {
    const key = f.family.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  state.organizationFonts = unique.map((f) => ({
    id: `organization:${f.family}`,
    label: f.family,
    family: f.family,
    stack: organizationFontStack(f.family, f.category),
    source: "organization",
    category: isCategory(f.category) ? f.category : "sans",
    cssUrl: f.cssUrl,
  }));
  state.fontOptions = [
    ...BUNDLED_FONTS,
    ...state.organizationFonts,
    ...SYSTEM_FONTS,
  ];
  notify();
};

export const getFontOptions = (): FontOption[] => state.fontOptions;

export const getOrganizationFonts = (): FontOption[] => state.organizationFonts;

export const subscribeToFontOptions = (listener: () => void): (() => void) => {
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
};

export const DEFAULT_FONT_STACK = "Arial, sans-serif";

export const primaryFamily = (stack: string): string =>
  (stack.split(",")[0] ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();

export const findFontOption = (
  stack: string | undefined,
): FontOption | undefined => {
  if (!stack) return undefined;
  const options = getFontOptions();
  const exact = options.find((f) => f.stack === stack);
  if (exact) return exact;
  const primary = primaryFamily(stack);
  return options.find((f) => primaryFamily(f.stack) === primary);
};

export type AddFontHandler = () => Promise<string | null>;

export const setAddFontHandler = (handler: AddFontHandler | null): void => {
  state.addFontHandler = handler;
  notify();
};

export const getAddFontHandler = (): AddFontHandler | null =>
  state.addFontHandler;

const FIRST_MISSING_DELAY_MS = 15_000;
const MAX_MISSING_DELAY_MS = 5 * 60_000;

const missing = new Map<
  string,
  { stack: string; nextAt: number; delay: number }
>();
const missingListeners = new Set<(family: string) => void>();
let recheckTimer: ReturnType<typeof setTimeout> | null = null;

const announceMissing = (family: string, stack: string, delay: number) => {
  missing.set(family, { stack, nextAt: Date.now() + delay, delay });
  for (const listener of missingListeners) listener(family);
  scheduleRecheck();
};

// The wait doubles, so a font that never turns up costs little
const scheduleRecheck = () => {
  if (recheckTimer || missing.size === 0) return;
  const nextAt = Math.min(...[...missing.values()].map((m) => m.nextAt));
  recheckTimer = setTimeout(
    () => {
      recheckTimer = null;
      const now = Date.now();
      for (const [family, m] of missing) {
        if (findFontOption(m.stack)) missing.delete(family);
        else if (now >= m.nextAt) {
          announceMissing(
            family,
            m.stack,
            Math.min(m.delay * 2, MAX_MISSING_DELAY_MS),
          );
        }
      }
      scheduleRecheck();
    },
    Math.max(0, nextAt - Date.now()),
  );
};

/** For a stack no option provides. Reported again until it turns up. */
export const reportMissingFont = (stack: string): void => {
  const family = primaryFamily(stack);
  if (!family || missing.has(family)) return;
  announceMissing(family, stack, FIRST_MISSING_DELAY_MS);
};

export const subscribeToMissingFonts = (
  listener: (family: string) => void,
): (() => void) => {
  missingListeners.add(listener);
  return () => {
    missingListeners.delete(listener);
  };
};
