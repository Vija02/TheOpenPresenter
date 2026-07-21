import { Button, OverlayToggle, cn } from "@repo/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { VscGear, VscListSelection, VscSearch } from "react-icons/vsc";
import { typeidUnboxed } from "typeid-js";

import { getStandardBooks } from "../../../src/builtin/versification";
import {
  BibleBookIndex,
  BibleBookMeta,
  BiblePassage,
} from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import SettingsModal from "../translations/SettingsModal";
import { useCustomTranslations } from "../translations/customTranslations";
import BiblePicker from "./BiblePicker";
import { parseReferenceInIndex, suggestBooks } from "./bookIndex";

type ReferenceInput = {
  translationId: string;
  bookName: string;
  bookNumber: number;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
};

type Submitted =
  | { kind: "custom"; input: ReferenceInput & { pluginId: string } }
  | { kind: "catalog"; input: ReferenceInput };

const SearchBar = () => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const {
    translations: customTranslations,
    get: getCustom,
    pluginId,
  } = useCustomTranslations();

  // Catalog translations the org selected in Settings.
  const prefsQuery = trpc.bible.preferences.get.useQuery(
    { pluginId },
    { refetchOnWindowFocus: false },
  );
  const selectedCatalogIds = useMemo(() => {
    const ids = prefsQuery.data?.translationIds ?? [];
    return ids.filter((id) => !getCustom(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsQuery.data, customTranslations]);

  const catalogMetaQuery = trpc.bible.catalog.byIds.useQuery(
    { pluginId, ids: selectedCatalogIds },
    { enabled: selectedCatalogIds.length > 0, refetchOnWindowFocus: false },
  );
  // Only translations we can actually serve; "upload required" ones can't
  // resolve until their text has been uploaded.
  const publicCatalog = useMemo(
    () => (catalogMetaQuery.data ?? []).filter((t) => t.source === "helloao"),
    [catalogMetaQuery.data],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const processedTokenRef = useRef(0);

  const [input, setInput] = useState("");
  const [translation, setTranslation] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [token, setToken] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  const customSelected = getCustom(translation);
  const catalogSelected = useMemo(
    () => publicCatalog.find((t) => t.id === translation),
    [publicCatalog, translation],
  );

  // Seed the picker once options are known: the org's primary translation if
  // it's usable, otherwise the first thing available.
  useEffect(() => {
    if (translation && (customSelected || catalogSelected)) return;
    const primary = prefsQuery.data?.primaryTranslationId ?? null;
    const usableIds = [
      ...publicCatalog.map((t) => t.id),
      ...customTranslations.map((t) => t.id),
    ];
    const next =
      primary && usableIds.includes(primary) ? primary : usableIds[0];
    if (next && next !== translation) setTranslation(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsQuery.data, publicCatalog, customTranslations]);

  // Native book index for the selected catalog translation (fetched lazily).
  const catalogBooksQuery = trpc.bible.catalog.books.useQuery(
    { translationId: translation },
    { enabled: !!catalogSelected, refetchOnWindowFocus: false },
  );

  const translationName = useMemo(() => {
    if (customSelected) return customSelected.name;
    if (catalogSelected) return catalogSelected.name;
    return translation;
  }, [customSelected, catalogSelected, translation]);

  // Index that drives autocomplete AND the drill-down grid. Uploaded and
  // catalog translations both carry their own native index.
  const bookIndex = useMemo<BibleBookIndex>(() => {
    if (customSelected) return customSelected.books;
    if (catalogSelected) return catalogBooksQuery.data ?? [];
    return getStandardBooks();
  }, [customSelected, catalogSelected, catalogBooksQuery.data]);

  const suggestions = useMemo(
    () => (open ? suggestBooks(bookIndex, input) : []),
    [open, input, bookIndex],
  );

  const resolveCustom = trpc.bible.resolveCustom.useQuery(
    submitted?.kind === "custom"
      ? submitted.input
      : {
          pluginId: "",
          translationId: "",
          bookName: "",
          bookNumber: 0,
          chapter: 0,
        },
    {
      enabled: submitted?.kind === "custom",
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const resolveCatalog = trpc.bible.resolveCatalog.useQuery(
    submitted?.kind === "catalog"
      ? submitted.input
      : { translationId: "", bookName: "", bookNumber: 0, chapter: 0 },
    {
      enabled: submitted?.kind === "catalog",
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const addPassage = (data: {
    reference: string;
    translationId: string;
    translationName: string;
    translationAbbreviation?: string | null;
    verses: BiblePassage["verses"];
  }) => {
    const passage: BiblePassage = {
      id: typeidUnboxed(),
      reference: data.reference,
      translationId: data.translationId,
      translationName: data.translationName,
      translationAbbreviation: data.translationAbbreviation ?? null,
      verses: data.verses,
    };
    mutableSceneData.pluginData.passages.push(passage);
    setInput("");
    setSubmitted(null);
    setOpen(false);
    setActiveIndex(-1);
  };

  // Add the passage as soon as the active resolution succeeds.
  useEffect(() => {
    if (!submitted) return;
    const q = submitted.kind === "custom" ? resolveCustom : resolveCatalog;
    if (q.isSuccess && q.data && processedTokenRef.current !== token) {
      processedTokenRef.current = token;
      addPassage(q.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    resolveCustom.isSuccess,
    resolveCustom.data,
    resolveCatalog.isSuccess,
    resolveCatalog.data,
    submitted,
    token,
  ]);

  // Shared resolution path for both the typed box and the drill-down grid.
  const addByReference = (reference: string) => {
    const trimmed = reference.trim();
    if (!trimmed) return;
    setOpen(false);
    setActiveIndex(-1);
    setLocalError(null);

    if (!customSelected && !catalogSelected) {
      setLocalError("Pick a translation in Settings first.");
      return;
    }
    if (bookIndex.length === 0) {
      setLocalError("Loading translation, try again in a moment…");
      return;
    }

    const parsed = parseReferenceInIndex(bookIndex, trimmed);
    if (!parsed) {
      setLocalError(`Could not understand "${trimmed}"`);
      return;
    }

    setToken((t) => t + 1);
    const refInput: ReferenceInput = {
      translationId: translation,
      bookName: parsed.book.name,
      bookNumber: parsed.book.n,
      chapter: parsed.chapter,
      verseStart: parsed.verseStart,
      verseEnd: parsed.verseEnd,
    };
    setSubmitted(
      customSelected
        ? { kind: "custom", input: { ...refInput, pluginId } }
        : { kind: "catalog", input: refInput },
    );
  };

  const selectSuggestion = (book: BibleBookMeta) => {
    setInput(book.name + " ");
    setOpen(false);
    setActiveIndex(-1);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(
          (i) => (i - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]!);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }
    if (e.key === "Enter") addByReference(input);
  };

  const activeQuery =
    submitted?.kind === "custom"
      ? resolveCustom
      : submitted?.kind === "catalog"
        ? resolveCatalog
        : null;
  const isSearching = !!submitted && !!activeQuery?.isFetching;
  const hasTranslations =
    customTranslations.length > 0 || publicCatalog.length > 0;
  const errorMessage =
    localError ??
    (submitted && activeQuery?.isError
      ? activeQuery.error?.message || "Could not find that passage"
      : null);

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
        <div className="relative flex-1">
          <VscSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setActiveIndex(-1);
              setOpen(true);
              setLocalError(null);
              if (submitted) setSubmitted(null);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
            placeholder="Search a passage, e.g. John 3:16-18"
            data-testid="bible-search-input"
            className="w-full h-9 pl-8 pr-3 border border-stroke rounded bg-surface-primary outline-none focus:border-primary"
          />

          {open && suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border border-stroke rounded bg-surface-primary shadow-lg">
              {suggestions.map((book, i) => (
                <li key={book.n}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(book);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 cursor-pointer",
                      i === activeIndex
                        ? "bg-surface-primary-active"
                        : "hover:bg-surface-primary-hover",
                    )}
                  >
                    {book.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <select
          className="h-9 border border-stroke rounded px-2 bg-surface-primary sm:w-56"
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          aria-label="Translation"
          disabled={!hasTranslations}
        >
          {!hasTranslations && <option value="">No translations yet</option>}
          {customTranslations.length > 0 && (
            <optgroup label="Your translations">
              {customTranslations.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
          {publicCatalog.length > 0 && (
            <optgroup label="Added translations">
              {publicCatalog.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <div className="flex gap-2">
          <Button
            onClick={() => addByReference(input)}
            disabled={isSearching || !input.trim()}
            data-testid="bible-search-add"
          >
            <VscSearch />
            {isSearching ? "Searching..." : "Add"}
          </Button>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                variant="outline"
                onClick={onToggle}
                title="Browse books"
                data-testid="bible-browse"
              >
                <VscListSelection />
                Browse
              </Button>
            )}
          >
            <BiblePicker
              index={bookIndex}
              translationName={translationName}
              onPick={addByReference}
            />
          </OverlayToggle>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                variant="outline"
                onClick={onToggle}
                title="Settings"
                data-testid="bible-settings"
              >
                <VscGear />
              </Button>
            )}
          >
            <SettingsModal />
          </OverlayToggle>
        </div>
      </div>

      {errorMessage && (
        <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
      )}
    </div>
  );
};

export default SearchBar;
