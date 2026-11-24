import { GoogleFontCatalogQuery } from "@repo/graphql";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { FontSampleRow } from "./FontSampleRow";
import {
  clearGoogleFontPreviews,
  loadGoogleFontPreview,
  previewFamilyName,
} from "./googlePreview";
import { sampleFor } from "./samples";
import { scrollParentOf } from "./scrollParent";

export type GoogleFont = GoogleFontCatalogQuery["googleFontCatalog"][number];

export const GOOGLE_CATEGORY_FILTERS = [
  { value: "", label: "All" },
  { value: "Sans Serif", label: "Sans serif" },
  { value: "Serif", label: "Serif" },
  { value: "Display", label: "Display" },
  { value: "Handwriting", label: "Handwriting" },
  { value: "Monospace", label: "Monospace" },
];

const GOOGLE_CATEGORY_BY_OURS: Record<string, string> = {
  sans: "Sans Serif",
  serif: "Serif",
  display: "Display",
  mono: "Monospace",
};

/** Google's own category, else the closest to ours */
export const googleCategoryOf = (
  family: string,
  category: string,
  catalog: GoogleFont[] | undefined,
) =>
  catalog?.find((f) => f.family.toLowerCase() === family.toLowerCase())
    ?.googleCategory ??
  GOOGLE_CATEGORY_BY_OURS[category] ??
  "Sans Serif";

export type GoogleFontSort = "popular" | "name";

export const filterGoogleFonts = (
  catalog: GoogleFont[] | undefined,
  {
    search,
    category,
    sort,
  }: { search: string; category: string; sort: GoogleFontSort },
): GoogleFont[] => {
  if (!catalog) return [];
  const needle = search.trim().toLowerCase();
  return catalog
    .filter(
      (f) =>
        (!category || f.googleCategory === category) &&
        (!needle || f.family.toLowerCase().includes(needle)),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.family.localeCompare(b.family)
        : a.popularity - b.popularity,
    );
};

export const describeStyles = (f: GoogleFont) =>
  f.axisCount > 0
    ? `Variable${f.axisCount > 1 ? ` (${f.axisCount} axes)` : ""}`
    : `${f.styleCount} ${f.styleCount === 1 ? "style" : "styles"}`;

const PAGE_SIZE = 40;

export const GoogleFontList = ({
  fonts,
  previewText,
  size,
  selected,
  onSelect,
  renderAction,
}: {
  fonts: GoogleFont[];
  /** Debounced. Empty for the default samples */
  previewText: string;
  size: number;
  selected?: string | null;
  onSelect?: (family: string) => void;
  renderAction?: (font: GoogleFont) => ReactNode;
}) => {
  const [shown, setShown] = useState(PAGE_SIZE);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setShown(PAGE_SIZE), [fonts]);
  // New text needs new glyphs
  useEffect(() => setLoaded({}), [previewText]);
  useEffect(() => clearGoogleFontPreviews, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown((n) => n + PAGE_SIZE);
        }
      },
      { root: scrollParentOf(sentinel), rootMargin: "600px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fonts, shown]);

  const preview = useCallback(
    (font: GoogleFont) => {
      // Shown even on failure: the fallback beats nothing
      void loadGoogleFontPreview(
        font.family,
        sampleFor(font, previewText),
      ).then(() => setLoaded((l) => ({ ...l, [font.family]: true })));
    },
    [previewText],
  );

  return (
    <>
      {fonts.slice(0, shown).map((f) => (
        <FontSampleRow
          key={`${f.family}\n${previewText}`}
          name={f.family}
          details={[describeStyles(f), f.designers.join(", ")]}
          fontFamily={`"${previewFamilyName(f.family)}", ${
            f.category === "serif" ? "serif" : "sans-serif"
          }`}
          sample={sampleFor(f, previewText)}
          size={size}
          loaded={!!loaded[f.family]}
          selected={selected === f.family}
          onClick={onSelect ? () => onSelect(f.family) : undefined}
          onVisible={() => preview(f)}
          action={renderAction?.(f)}
        />
      ))}
      {shown < fonts.length && <div ref={sentinelRef} />}
    </>
  );
};

export const useDebounced = <T,>(value: T, ms: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
};
