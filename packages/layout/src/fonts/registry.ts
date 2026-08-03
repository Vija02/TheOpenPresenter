export type FontSource = "bundled" | "system";

export type FontCategory = "sans" | "serif" | "display" | "mono";

export type FontOption = {
  id: string;
  label: string;
  /** The value written into `style.fontFamily`. */
  stack: string;
  source: FontSource;
  category: FontCategory;
  family?: string;
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

export const FONT_OPTIONS: FontOption[] = [...BUNDLED_FONTS, ...SYSTEM_FONTS];

export const DEFAULT_FONT_STACK = "Arial, sans-serif";

const primaryFamily = (stack: string): string =>
  (stack.split(",")[0] ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();

export const findFontOption = (
  stack: string | undefined,
): FontOption | undefined => {
  if (!stack) return undefined;
  const exact = FONT_OPTIONS.find((f) => f.stack === stack);
  if (exact) return exact;
  const primary = primaryFamily(stack);
  return FONT_OPTIONS.find((f) => primaryFamily(f.stack) === primary);
};
