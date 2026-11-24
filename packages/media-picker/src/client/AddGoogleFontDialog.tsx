import {
  useAddGoogleFontMutation,
  useGoogleFontCatalogQuery,
} from "@repo/graphql";
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@repo/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiSearch } from "react-icons/fi";

import { FontPreviewControls } from "./fonts/FontPreviewControls";
import {
  GOOGLE_CATEGORY_FILTERS,
  GoogleFontList,
  GoogleFontSort,
  describeStyles,
  filterGoogleFonts,
  useDebounced,
} from "./fonts/GoogleFontList";

export const FONT_CATEGORY_LABELS: Record<string, string> = {
  sans: "Sans serif",
  serif: "Serif",
  display: "Display",
  mono: "Monospace",
};

const DIALOG_PREVIEW_SIZE = 32;
export const PREVIEW_TEXT_DEBOUNCE_MS = 350;

export type AddedGoogleFont = { family: string; category: string };

/** `onDone` gets the added family, or null when cancelled */
export const AddGoogleFontDialog = ({
  isOpen,
  organizationId,
  addedFamilies = [],
  onDone,
}: {
  isOpen: boolean;
  organizationId: string;
  addedFamilies?: string[];
  onDone: (added: AddedGoogleFont | null) => void;
}) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<GoogleFontSort>("popular");
  const [previewText, setPreviewText] = useState("");
  const debouncedText = useDebounced(previewText, PREVIEW_TEXT_DEBOUNCE_MS);
  const [size, setSize] = useState(DIALOG_PREVIEW_SIZE);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [{ data, fetching, error: catalogError }] = useGoogleFontCatalogQuery({
    pause: !isOpen,
  });
  const [{ fetching: adding }, addGoogleFont] = useAddGoogleFontMutation();

  const added = useMemo(
    () => new Set(addedFamilies.map((f) => f.toLowerCase())),
    [addedFamilies],
  );

  useEffect(() => {
    if (isOpen) return;
    setSearch("");
    setFilter("");
    setSelected(null);
    setError(null);
  }, [isOpen]);

  const all = data?.googleFontCatalog;
  const results = useMemo(
    () => filterGoogleFonts(all, { search, category: filter, sort }),
    [all, search, filter, sort],
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [search, filter, sort]);

  const selectedFont = all?.find((f) => f.family === selected);
  const selectedIsAdded =
    !!selectedFont && added.has(selectedFont.family.toLowerCase());

  const add = async () => {
    if (!selectedFont || selectedIsAdded) return;
    setError(null);
    try {
      const result = await addGoogleFont({
        organizationId,
        family: selectedFont.family,
      });
      if (!result?.addGoogleFont) throw new Error("No font returned");
      onDone({
        family: result.addGoogleFont.family,
        category: selectedFont.category,
      });
    } catch {
      setError("Couldn't add this font. Check your internet and try again.");
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !adding) onDone(null);
      }}
    >
      <DialogContent size="3xl">
        <DialogHeader>
          <DialogTitle>Add a font</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="bp--font-dialog">
            <div className="bp--font-dialog__search">
              <div className="bp--font-dialog__search-field">
                <FiSearch />
                <Input
                  autoFocus
                  placeholder="Search fonts"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="bp--font-dialog__sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                aria-label="Sort by"
              >
                <option value="popular">Most popular</option>
                <option value="name">Name</option>
              </select>
            </div>

            <div className="bp--font-chips" role="group" aria-label="Category">
              {GOOGLE_CATEGORY_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`bp--font-chip ${
                    filter === f.value ? "bp--font-chip--active" : ""
                  }`}
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <FontPreviewControls
              text={previewText}
              onTextChange={setPreviewText}
              size={size}
              onSizeChange={setSize}
            />

            {all && (
              <div className="bp--font-dialog__count">
                {results.length.toLocaleString()} of{" "}
                {all.length.toLocaleString()} families
              </div>
            )}

            <div className="bp--font-dialog__list" ref={listRef} role="listbox">
              {fetching && (
                <p className="bp--font-dialog__message">Loading fonts…</p>
              )}
              {catalogError && (
                <p className="bp--font-dialog__message">
                  Couldn't load Google Fonts. You need internet to add a font.
                </p>
              )}
              {all && results.length === 0 && (
                <p className="bp--font-dialog__message">No fonts match.</p>
              )}
              <GoogleFontList
                fonts={results}
                previewText={debouncedText}
                size={size}
                selected={selected}
                onSelect={setSelected}
                renderAction={(f) =>
                  added.has(f.family.toLowerCase()) ? (
                    <Badge variant="success" size="sm">
                      Added
                    </Badge>
                  ) : undefined
                }
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <div className="bp--font-dialog__footer">
            <div className="bp--font-dialog__status">
              {error ? (
                <span className="bp--font-dialog__error">{error}</span>
              ) : adding ? (
                `Saving every style of ${selectedFont?.family}…`
              ) : selectedIsAdded ? (
                `${selectedFont?.family} is already added.`
              ) : selectedFont ? (
                `${selectedFont.family} · ${describeStyles(selectedFont)}`
              ) : (
                "Select a font to add it."
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => onDone(null)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              onClick={add}
              disabled={!selectedFont || selectedIsAdded || adding}
            >
              {adding ? "Adding…" : "Add font"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
