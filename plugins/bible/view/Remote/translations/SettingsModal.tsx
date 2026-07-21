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
  cn,
  useOverlayToggle,
} from "@repo/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  VscClose,
  VscCloudUpload,
  VscStarEmpty,
  VscStarFull,
} from "react-icons/vsc";

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
  isPrimary: boolean;
  isSecondary: boolean;
  isFavorite: boolean;
  onSelectPrimary: (id: string) => void;
  onToggleParallel: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

// One catalog row. Shared by the "Selected" and "All translations" sections so
// every translation renders identically. Controls, left-to-right:
//   ★ favorite     — pins the row to the top for quick access
//   Add parallel   — enables it as a secondary shown alongside the primary
//   Use            — makes it the sole primary (rightmost, primary action)
const TranslationRow = ({
  t,
  isPrimary,
  isSecondary,
  isFavorite,
  onSelectPrimary,
  onToggleParallel,
  onRemove,
  onToggleFavorite,
}: RowProps) => {
  const usable = isUsable(t);
  const badge = BADGE[t.availability];
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2",
        isPrimary
          ? "bg-blue-50"
          : isSecondary
            ? "bg-blue-50/60"
            : "bg-surface-primary hover:bg-gray-50",
      )}
    >
      <button
        type="button"
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(t.id);
        }}
        className={cn(
          "shrink-0 p-1 rounded cursor-pointer",
          isFavorite ? "text-yellow-500" : "text-secondary hover:text-gray-700",
        )}
      >
        {isFavorite ? <VscStarFull /> : <VscStarEmpty />}
      </button>

      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">
          {t.name}
          {t.abbreviation ? (
            <span className="text-secondary font-normal">
              {" "}
              · {t.abbreviation}
            </span>
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
        isPrimary || isSecondary ? (
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "inline-block px-1.5 py-0.5 rounded text-[10px] font-medium",
                isPrimary
                  ? "bg-blue-600 text-white"
                  : "bg-blue-100 text-blue-700",
              )}
            >
              {isPrimary ? "Primary" : "Parallel"}
            </span>
            {!isPrimary && (
              <button
                type="button"
                title="Remove from selection"
                aria-label="Remove from selection"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(t.id);
                }}
                className="shrink-0 p-1 rounded cursor-pointer text-secondary hover:text-red-600 hover:bg-red-50"
              >
                <VscClose />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="xs"
              variant="ghost"
              title="Show alongside the primary translation"
              onClick={(e) => {
                e.stopPropagation();
                onToggleParallel(t.id);
              }}
            >
              Parallel
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Use this as the primary translation"
              onClick={(e) => {
                e.stopPropagation();
                onSelectPrimary(t.id);
              }}
            >
              Use
            </Button>
          </div>
        )
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
    </div>
  );
};

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-3 py-1.5 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-secondary">
    {label}
  </div>
);

// The main configuration surface for the Bible plugin: browse the catalog of
// translations (public + copyrighted-needs-upload + your uploads), filter by
// language, favourite the ones you use often (pinned to the top), pick one
// primary translation and optionally show others in parallel.
//
// Backend-centric: filtering, sorting and pagination all happen server-side, so
// the client only ever holds the current page plus the (few) pinned rows.
const SettingsModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const utils = trpc.useUtils();

  // Draft state seeded from saved prefs once loaded.
  const [languages, setLanguages] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
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
  // Metadata for the pinned rows (selected + favourites), so they stay on top
  // regardless of which page (or filter) they'd otherwise fall under.
  const pinnedIds = useMemo(
    () => Array.from(new Set([...selectedIds, ...favoriteIds])),
    [selectedIds, favoriteIds],
  );
  const pinnedQuery = trpc.bible.catalog.byIds.useQuery(
    { pluginId, ids: pinnedIds },
    { enabled: pinnedIds.length > 0, refetchOnWindowFocus: false },
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
    setFavoriteIds(prefsQuery.data.favoriteIds ?? []);
  }, [prefsQuery.data]);

  const languageOptions = useMemo(
    () => languagesQuery.data ?? [],
    [languagesQuery.data],
  );

  // Remember metadata for every row we've seen (list pages + pinned byIds), so
  // a newly toggled row can move between sections instantly without waiting for
  // a refetch (avoids a flash where it briefly disappears).
  const metaCache = useRef(new Map<string, CatalogTranslation>());
  useMemo(() => {
    for (const page of listQuery.data?.pages ?? []) {
      for (const t of page.items) metaCache.current.set(t.id, t);
    }
    for (const t of pinnedQuery.data ?? []) metaCache.current.set(t.id, t);
  }, [listQuery.data, pinnedQuery.data]);

  // "Use" makes a translation the sole primary (replacing any parallels).
  const selectPrimary = (id: string) => {
    setSaved(false);
    if (primaryId === id) {
      // Clicking the current primary again clears the selection.
      setPrimaryId(null);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      return;
    }
    setPrimaryId(id);
    setSelectedIds([id]);
  };

  // "Add parallel" enables an extra translation shown alongside the primary.
  const toggleParallel = (id: string) => {
    setSaved(false);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        if (primaryId === id) setPrimaryId(next[0] ?? null);
        return next;
      }
      return [...prev, id];
    });
  };

  const toggleFavorite = (id: string) => {
    setSaved(false);
    setFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Remove a translation from the selection (X on a Selected row). Clears the
  // primary too when it was the one removed.
  const removeSelected = (id: string) => {
    setSaved(false);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    if (primaryId === id) setPrimaryId(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, primaryId, listQuery.data, pinnedQuery.data]);

  // Favourited translations that aren't already selected — rendered at the top
  // of the "All translations" list for quick access.
  const favoriteRows = useMemo(() => {
    const sel = new Set(selectedIds);
    return favoriteIds
      .filter((id) => !sel.has(id))
      .map((id) => metaCache.current.get(id))
      .filter((t): t is CatalogTranslation => Boolean(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteIds, selectedIds, listQuery.data, pinnedQuery.data]);

  // Paginated list rows, with selected + favourite rows filtered out (they're
  // pinned above).
  const listRows = useMemo(() => {
    const excluded = new Set([...selectedIds, ...favoriteIds]);
    const seen = new Set<string>();
    const out: CatalogTranslation[] = [];
    for (const page of listQuery.data?.pages ?? []) {
      for (const t of page.items) {
        if (excluded.has(t.id) || seen.has(t.id)) continue;
        seen.add(t.id);
        out.push(t);
      }
    }
    return out;
  }, [listQuery.data, selectedIds, favoriteIds]);

  const total = listQuery.data?.pages[0]?.total ?? 0;

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = listQuery;

  const loadedCount = useMemo(
    () =>
      (listQuery.data?.pages ?? []).reduce(
        (sum, page) => sum + page.items.length,
        0,
      ),
    [listQuery.data],
  );

  const listRef = useRef<HTMLDivElement | null>(null);
  const onListScroll = () => {
    const el = listRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
      fetchNextPage();
    }
  };

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
        favoriteIds,
      });
      await utils.bible.preferences.get.invalidate();
      setSaved(true);
      onToggle?.();
    } finally {
      setSaving(false);
    }
  };

  const loading = listQuery.isLoading || prefsQuery.isLoading;
  // A primary translation is always required before saving.
  const needsPrimary = !primaryId;

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

                {!loading && selectedRows.length > 0 && (
                  <>
                    <SectionHeader label="Selected" />
                    {selectedRows.map((t) => (
                      <TranslationRow
                        key={`sel-${t.id}`}
                        t={t}
                        isPrimary={primaryId === t.id}
                        isSecondary={primaryId !== t.id}
                        isFavorite={favoriteIds.includes(t.id)}
                        onSelectPrimary={selectPrimary}
                        onToggleParallel={toggleParallel}
                        onRemove={removeSelected}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </>
                )}

                {!loading &&
                  (favoriteRows.length > 0 || listRows.length > 0) && (
                    <>
                      {selectedRows.length > 0 && (
                        <SectionHeader label="All translations" />
                      )}
                      {favoriteRows.map((t) => (
                        <TranslationRow
                          key={`fav-${t.id}`}
                          t={t}
                          isPrimary={false}
                          isSecondary={false}
                          isFavorite
                          onSelectPrimary={selectPrimary}
                          onToggleParallel={toggleParallel}
                          onRemove={removeSelected}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                      {listRows.map((t) => (
                        <TranslationRow
                          key={t.id}
                          t={t}
                          isPrimary={false}
                          isSecondary={false}
                          isFavorite={favoriteIds.includes(t.id)}
                          onSelectPrimary={selectPrimary}
                          onToggleParallel={toggleParallel}
                          onRemove={removeSelected}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </>
                  )}

                {!loading &&
                  selectedRows.length === 0 &&
                  favoriteRows.length === 0 &&
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
          {needsPrimary && (
            <span className="text-sm text-red-600">
              Pick a primary translation (Use) to save
            </span>
          )}
          {saved && !needsPrimary && (
            <span className="text-sm text-green-600">Saved</span>
          )}
          <Button variant="outline" onClick={onToggle}>
            Close
          </Button>
          <Button onClick={save} disabled={saving || needsPrimary}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
