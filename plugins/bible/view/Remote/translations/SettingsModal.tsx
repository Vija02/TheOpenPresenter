import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  OverlayToggle,
  Select,
  Switch,
  cn,
  useOverlayToggle,
} from "@repo/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { VscCloudUpload, VscStarEmpty, VscStarFull } from "react-icons/vsc";

import type { CatalogTranslation } from "../../../src/catalog";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import TranslationsModal from "./TranslationsModal";

// Availability -> small badge shown on each row.
const BADGE: Record<
  CatalogTranslation["availability"],
  { label: string; className: string; title: string }
> = {
  public: {
    label: "Public",
    className: "bg-green-100 text-green-700",
    title: "Free to use — served directly, no upload needed",
  },
  uploaded: {
    label: "Uploaded",
    className: "bg-blue-100 text-blue-700",
    title: "You have uploaded this translation",
  },
  upload: {
    label: "Upload required",
    className: "bg-gray-100 text-gray-600",
    title: "Copyrighted — you must upload your own copy to use it",
  },
};

const isUsable = (t: CatalogTranslation) => t.availability !== "upload";

const PAGE_SIZE = 50;

const SCOPES = [
  { value: false, label: "All" },
  { value: true, label: "Ready to use" },
] as const;

type RowProps = {
  t: CatalogTranslation;
  isSelected: boolean;
  isPrimary: boolean;
  onToggle: (id: string) => void;
  onMakePrimary: (id: string) => void;
};

// One catalog row. Shared by the pinned "selected" section and the paginated
// list so both render identically.
const TranslationRow = ({
  t,
  isSelected,
  isPrimary,
  onToggle,
  onMakePrimary,
}: RowProps) => {
  const usable = isUsable(t);
  const badge = BADGE[t.availability];
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2",
        usable ? "cursor-pointer" : "opacity-80",
        isSelected ? "bg-blue-50" : "bg-surface-primary hover:bg-gray-50",
      )}
      onClick={() => usable && onToggle(t.id)}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">
          {t.name}
          {t.abbreviation ? (
            <span className="text-secondary font-normal"> · {t.abbreviation}</span>
          ) : null}
        </p>
        <p className="text-xs text-secondary flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block px-1.5 py-0.5 rounded text-[10px] font-medium",
              badge.className,
            )}
            title={badge.title}
          >
            {badge.label}
          </span>
          {t.languageLabel}
        </p>
      </div>
      {usable ? (
        <button
          type="button"
          title={isPrimary ? "Primary translation" : "Set as primary"}
          onClick={(e) => {
            e.stopPropagation();
            onMakePrimary(t.id);
          }}
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded shrink-0",
            isPrimary ? "text-yellow-500" : "text-secondary hover:text-gray-700",
          )}
        >
          {isPrimary ? <VscStarFull /> : <VscStarEmpty />}
          {isPrimary ? "Primary" : "Make primary"}
        </button>
      ) : (
        <OverlayToggle
          toggler={({ onToggle: openUploads }) => (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                openUploads();
              }}
            >
              <VscCloudUpload />
              Upload
            </Button>
          )}
        >
          <TranslationsModal
            catalogId={t.id}
            catalogName={t.name}
            catalogAbbreviation={t.abbreviation}
            catalogLanguage={t.language}
          />
        </OverlayToggle>
      )}
      <Switch
        size="sm"
        checked={isSelected}
        disabled={!usable}
        onCheckedChange={() => onToggle(t.id)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Use ${t.name}`}
        className="shrink-0"
      />
    </div>
  );
};

// The main configuration surface for the Bible plugin: browse the catalog of
// translations (public + copyrighted-needs-upload + your uploads), filter by
// language, and choose which to present (one primary + others in parallel).
//
// Backend-centric: filtering, sorting and pagination all happen server-side, so
// the client only ever holds the current page plus the (few) selected rows —
// never the full ~2,300-entry catalog.
const SettingsModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  // Draft state seeded from saved prefs once loaded.
  const [languages, setLanguages] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [onlyUsable, setOnlyUsable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Debounce the search box so each keystroke doesn't hit the server.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const prefsQuery = trpc.bible.preferences.get.useQuery(
    { pluginId },
    { refetchOnWindowFocus: false },
  );
  const languagesQuery = trpc.bible.catalog.languages.useQuery(
    { pluginId },
    { refetchOnWindowFocus: false },
  );
  // Metadata for the selected rows, so they can be pinned on top regardless of
  // which page (or filter) they'd fall under.
  const selectedQuery = trpc.bible.catalog.byIds.useQuery(
    { pluginId, ids: selectedIds },
    { enabled: selectedIds.length > 0, refetchOnWindowFocus: false },
  );
  const listQuery = trpc.bible.catalog.list.useInfiniteQuery(
    {
      pluginId,
      query: debouncedQuery,
      languageKeys: languages,
      onlyUsable,
      limit: PAGE_SIZE,
    },
    {
      getNextPageParam: (last) => last.nextOffset ?? undefined,
      initialCursor: 0,
      refetchOnWindowFocus: false,
    },
  );
  const setMutation = trpc.bible.preferences.set.useMutation();

  useEffect(() => {
    if (!prefsQuery.data) return;
    setLanguages(prefsQuery.data.languages);
    setSelectedIds(prefsQuery.data.translationIds);
    setPrimaryId(prefsQuery.data.primaryTranslationId);
  }, [prefsQuery.data]);

  const languageOptions = useMemo(
    () => languagesQuery.data ?? [],
    [languagesQuery.data],
  );

  // Remember metadata for every row we've seen (list pages + byIds), so a newly
  // toggled row can move into the pinned section instantly without waiting for
  // byIds to refetch (avoids a flash where it briefly disappears).
  const metaCache = useRef(new Map<string, CatalogTranslation>());
  useMemo(() => {
    for (const page of listQuery.data?.pages ?? []) {
      for (const t of page.items) metaCache.current.set(t.id, t);
    }
    for (const t of selectedQuery.data ?? []) metaCache.current.set(t.id, t);
  }, [listQuery.data, selectedQuery.data]);

  const toggleSelected = (id: string) => {
    setSaved(false);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        if (primaryId === id) setPrimaryId(next[0] ?? null);
        return next;
      }
      if (primaryId === null) setPrimaryId(id);
      return [...prev, id];
    });
  };

  const makePrimary = (id: string) => {
    setSaved(false);
    setPrimaryId(id);
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  // Pinned selected rows: primary first, then in selection order.
  const selectedRows = useMemo(() => {
    const rows = selectedIds
      .map((id) => metaCache.current.get(id))
      .filter((t): t is CatalogTranslation => Boolean(t));
    return rows.sort((a, b) => {
      if (a.id === primaryId) return -1;
      if (b.id === primaryId) return 1;
      return selectedIds.indexOf(a.id) - selectedIds.indexOf(b.id);
    });
    // listQuery/selectedQuery data are deps so the cache reads stay fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, primaryId, listQuery.data, selectedQuery.data]);

  // Paginated list rows, with selected rows filtered out (they're pinned above).
  const listRows = useMemo(() => {
    const sel = new Set(selectedIds);
    const seen = new Set<string>();
    const out: CatalogTranslation[] = [];
    for (const page of listQuery.data?.pages ?? []) {
      for (const t of page.items) {
        if (sel.has(t.id) || seen.has(t.id)) continue;
        seen.add(t.id);
        out.push(t);
      }
    }
    return out;
  }, [listQuery.data, selectedIds]);

  const total = listQuery.data?.pages[0]?.total ?? 0;

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = listQuery;

  // How many rows are loaded (across pages) vs. how many match on the server.
  const loadedCount = useMemo(
    () =>
      (listQuery.data?.pages ?? []).reduce(
        (sum, page) => sum + page.items.length,
        0,
      ),
    [listQuery.data],
  );

  // Infinite scroll: auto-load the next page when scrolled near the bottom.
  // Listening to the scroll element's own onScroll avoids the
  // IntersectionObserver-root-in-a-modal ambiguity that failed before.
  const listRef = useRef<HTMLDivElement | null>(null);
  const onListScroll = () => {
    const el = listRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
      fetchNextPage();
    }
  };

  // If the loaded rows don't fill the container there's no scrollbar to drive
  // infinite loading, so keep fetching until it overflows or the list is
  // exhausted (covers narrow filters / tall viewports without a "Load more").
  useEffect(() => {
    const el = listRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    if (el.scrollHeight <= el.clientHeight) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, loadedCount]);

  const save = async () => {
    setSaving(true);
    try {
      await setMutation.mutateAsync({
        pluginId,
        languages,
        translationIds: selectedIds,
        primaryTranslationId: primaryId,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const loading = listQuery.isLoading || prefsQuery.isLoading;

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent
        size="full"
        className="gap-0 md:max-w-[90vw] md:min-h-[85vh]"
      >
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-2">
            <DialogTitle>Bible Settings</DialogTitle>
            <OverlayToggle
              toggler={({ onToggle: openUploads }) => (
                <Button size="xs" variant="outline" onClick={openUploads}>
                  <VscCloudUpload />
                  Add translation
                </Button>
              )}
            >
              <TranslationsModal />
            </OverlayToggle>
          </div>
        </DialogHeader>

        <DialogBody className="overflow-x-hidden pt-0 flex-1 flex flex-col min-h-0">
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <div className="flex flex-col gap-1.5 shrink-0">
              <p className="text-sm font-medium">Languages of interest</p>
              <Select
                isMulti
                options={languageOptions}
                value={languageOptions.filter((o) =>
                  languages.includes(o.value),
                )}
                onChange={(selected) => {
                  setSaved(false);
                  setLanguages(
                    Array.isArray(selected) ? selected.map((o) => o.value) : [],
                  );
                }}
                placeholder="All languages..."
              />
            </div>

            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <p className="text-sm font-medium shrink-0">Translations</p>

              <div className="flex flex-col sm:flex-row gap-2 sm:items-center shrink-0">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or abbreviation..."
                  className="flex-1 h-9 px-3 border border-stroke rounded bg-surface-primary outline-none focus:border-primary"
                />
                <div className="flex items-center gap-0.5 p-0.5 rounded-full border border-stroke bg-surface-primary shrink-0 self-start sm:self-auto">
                  {SCOPES.map((s) => (
                    <button
                      key={String(s.value)}
                      type="button"
                      onClick={() => setOnlyUsable(s.value)}
                      className={cn(
                        "px-3 py-1 text-xs rounded-full transition-colors whitespace-nowrap",
                        onlyUsable === s.value
                          ? "bg-blue-600 text-white"
                          : "text-secondary hover:bg-gray-100",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                ref={listRef}
                onScroll={onListScroll}
                className="border border-stroke rounded flex-1 min-h-0 overflow-y-auto divide-y divide-stroke"
              >
                {loading && (
                    <p className="text-sm text-secondary px-3 py-4">
                      Loading catalog…
                    </p>
                  )}

                  {!loading &&
                    selectedRows.map((t) => (
                      <TranslationRow
                        key={`sel-${t.id}`}
                        t={t}
                        isSelected
                        isPrimary={primaryId === t.id}
                        onToggle={toggleSelected}
                        onMakePrimary={makePrimary}
                      />
                    ))}

                  {!loading &&
                    listRows.map((t) => (
                      <TranslationRow
                        key={t.id}
                        t={t}
                        isSelected={false}
                        isPrimary={primaryId === t.id}
                        onToggle={toggleSelected}
                        onMakePrimary={makePrimary}
                      />
                    ))}

                  {!loading &&
                    selectedRows.length === 0 &&
                    listRows.length === 0 && (
                      <p className="text-sm text-secondary px-3 py-4">
                        No translations match your filters.
                      </p>
                    )}
              </div>

              {!loading && (
                <p className="text-xs text-secondary shrink-0">
                  {`Showing ${loadedCount} of ${total} matching translations` +
                    (selectedRows.length > 0
                      ? ` (${selectedRows.length} selected)`
                      : "")}
                  {isFetchingNextPage ? " · loading more…" : "."}
                </p>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="pt-0 pb-3 justify-end items-center gap-2">
          {saved && <span className="text-sm text-green-600">Saved</span>}
          <Button variant="outline" onClick={onToggle}>
            Close
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
