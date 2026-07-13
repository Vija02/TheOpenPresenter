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
import { useEffect, useMemo, useState } from "react";
import { VscCloudUpload, VscStarEmpty, VscStarFull } from "react-icons/vsc";

import { translations as builtinTranslations } from "../../../src/builtin/translations";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { useCustomTranslations } from "./customTranslations";
import TranslationsModal from "./TranslationsModal";

type AvailableTranslation = {
  id: string;
  name: string;
  language: string;
  abbreviation?: string | null;
  source: "builtin" | "custom";
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  id: "Indonesian",
  pt: "Portuguese",
  la: "Latin",
  ro: "Romanian",
  es: "Spanish",
  fr: "French",
  de: "German",
  ko: "Korean",
  zh: "Chinese",
};
const languageLabel = (code: string) =>
  LANGUAGE_LABELS[code] ?? code.toUpperCase();

// The main configuration surface for the Bible plugin: pick languages of
// interest, then choose which translations to present (one primary + others
// shown in parallel). Preferences are stored per organization.
const SettingsModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const { translations: custom } = useCustomTranslations();
  const prefsQuery = trpc.bible.preferences.get.useQuery(
    { pluginId },
    { refetchOnWindowFocus: false },
  );
  const setMutation = trpc.bible.preferences.set.useMutation();

  // Everything selectable: built-ins + the org's uploaded translations.
  const available = useMemo<AvailableTranslation[]>(
    () => [
      ...builtinTranslations.map((t) => ({
        id: t.id,
        name: t.name,
        language: t.language,
        source: "builtin" as const,
      })),
      ...custom.map((t) => ({
        id: t.id,
        name: t.name,
        language: t.language,
        abbreviation: t.abbreviation,
        source: "custom" as const,
      })),
    ],
    [custom],
  );

  const allLanguages = useMemo(
    () => Array.from(new Set(available.map((t) => t.language))).sort(),
    [available],
  );

  const languageOptions = useMemo(
    () =>
      allLanguages.map((code) => ({ label: languageLabel(code), value: code })),
    [allLanguages],
  );

  // Draft state seeded from saved prefs once loaded.
  const [languages, setLanguages] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!prefsQuery.data) return;
    setLanguages(prefsQuery.data.languages);
    setSelectedIds(prefsQuery.data.translationIds);
    setPrimaryId(prefsQuery.data.primaryTranslationId);
  }, [prefsQuery.data]);

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

  // Rows in the chosen languages (all if none chosen), selected pinned on top
  // (primary first, then in selection order), the rest alphabetical.
  const rows = useMemo(() => {
    const inLang =
      languages.length === 0
        ? available
        : available.filter((t) => languages.includes(t.language));
    const selected = new Set(selectedIds);
    const rank = (t: AvailableTranslation) =>
      t.id === primaryId ? 0 : selected.has(t.id) ? 1 : 2;
    return [...inLang].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 1) return selectedIds.indexOf(a.id) - selectedIds.indexOf(b.id);
      return a.name.localeCompare(b.name);
    });
  }, [available, languages, selectedIds, primaryId]);

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

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="3xl">
        <DialogHeader className="px-3 md:px-6">
          <DialogTitle>Bible Settings</DialogTitle>
        </DialogHeader>
        <DialogBody className="px-3 md:px-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Languages of interest</p>
              <p className="text-xs text-secondary">
                Pick the languages you present in. The translation list below is
                filtered to these.
              </p>
              {allLanguages.length === 0 ? (
                <p className="text-sm text-secondary">
                  No translations available yet.
                </p>
              ) : (
                <Select
                  isMulti
                  options={languageOptions}
                  value={languageOptions.filter((o) =>
                    languages.includes(o.value),
                  )}
                  onChange={(selected) => {
                    setSaved(false);
                    setLanguages(
                      Array.isArray(selected)
                        ? selected.map((o) => o.value)
                        : [],
                    );
                  }}
                  placeholder="Select languages..."
                />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Translations</p>
                <OverlayToggle
                  toggler={({ onToggle: openUploads }) => (
                    <Button size="sm" variant="outline" onClick={openUploads}>
                      <VscCloudUpload />
                      Manage uploads
                    </Button>
                  )}
                >
                  <TranslationsModal />
                </OverlayToggle>
              </div>
              <p className="text-xs text-secondary">
                Click a translation to use it. Selected ones are pinned on top;
                set one as primary — the others display in parallel.
              </p>

              <div className="border border-stroke rounded overflow-hidden">
                <div className="max-h-[45vh] overflow-y-auto divide-y divide-stroke">
                  {rows.map((t) => {
                    const isSelected = selectedIds.includes(t.id);
                    const isPrimary = primaryId === t.id;
                    return (
                      <div
                        key={`${t.source}:${t.id}`}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 cursor-pointer",
                          isSelected ? "bg-blue-50" : "hover:bg-gray-50",
                        )}
                        onClick={() => toggleSelected(t.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="pointer-events-none"
                        />
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
                          <p className="text-xs text-secondary">
                            {languageLabel(t.language)}
                            {t.source === "builtin" ? " · built-in" : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          title={
                            isPrimary ? "Primary translation" : "Set as primary"
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            makePrimary(t.id);
                          }}
                          className={cn(
                            "flex items-center gap-1 text-xs px-2 py-1 rounded",
                            isPrimary
                              ? "text-yellow-500"
                              : "text-secondary hover:text-gray-700",
                          )}
                        >
                          {isPrimary ? <VscStarFull /> : <VscStarEmpty />}
                          {isPrimary ? "Primary" : "Make primary"}
                        </button>
                      </div>
                    );
                  })}
                  {rows.length === 0 && (
                    <p className="text-sm text-secondary px-3 py-4">
                      No translations in the selected languages.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter className="px-3 md:px-6 pb-3 justify-end items-center gap-2">
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
