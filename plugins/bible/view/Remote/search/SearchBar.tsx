import { Button, OverlayToggle, cn } from "@repo/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { VscListSelection, VscSearch } from "react-icons/vsc";
import { typeidUnboxed } from "typeid-js";

import { getStandardBooks } from "../../../src/builtin/versification";
import {
  BibleBookIndex,
  BibleBookMeta,
  BiblePassage,
} from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
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

  const inputRef = useRef<HTMLInputElement>(null);
  const processedTokenRef = useRef(0);

  const [input, setInput] = useState("");
  // The translation used for lookups is always the org's primary preference.
  const translation = prefsQuery.data?.primaryTranslationId ?? "";
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [token, setToken] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  // Resolve the primary preference to something we can look up
  const primaryMeta = useMemo(
    () => (catalogMetaQuery.data ?? []).find((t) => t.id === translation),
    [catalogMetaQuery.data, translation],
  );
  const uploadId = getCustom(translation)?.id ?? primaryMeta?.uploadId ?? null;
  const uploadSelected = uploadId ? getCustom(uploadId) : undefined;
  const catalogSelected =
    !uploadSelected && primaryMeta?.source === "helloao"
      ? primaryMeta
      : undefined;

  // Native book index for the selected catalog translation (fetched lazily).
  const catalogBooksQuery = trpc.bible.catalog.books.useQuery(
    { translationId: translation },
    { enabled: !!catalogSelected, refetchOnWindowFocus: false },
  );

  const translationName = useMemo(() => {
    if (uploadSelected) return uploadSelected.name;
    if (catalogSelected) return catalogSelected.name;
    return primaryMeta?.name ?? translation;
  }, [uploadSelected, catalogSelected, primaryMeta, translation]);

  // Index that drives autocomplete AND the drill-down grid. Uploaded and
  // catalog translations both carry their own native index.
  const bookIndex = useMemo<BibleBookIndex>(() => {
    if (uploadSelected) return uploadSelected.books;
    if (catalogSelected) return catalogBooksQuery.data ?? [];
    return getStandardBooks();
  }, [uploadSelected, catalogSelected, catalogBooksQuery.data]);

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

    if (!uploadSelected && !catalogSelected) {
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
      translationId: uploadSelected ? uploadSelected.id : translation,
      bookName: parsed.book.name,
      bookNumber: parsed.book.n,
      chapter: parsed.chapter,
      verseStart: parsed.verseStart,
      verseEnd: parsed.verseEnd,
    };
    setSubmitted(
      uploadSelected
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
        </div>
      </div>

      {errorMessage && (
        <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
      )}
    </div>
  );
};

export default SearchBar;
