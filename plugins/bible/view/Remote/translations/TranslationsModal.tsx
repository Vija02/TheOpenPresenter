import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PopConfirm,
  useOverlayToggle,
} from "@repo/ui";
import { useRef, useState } from "react";
import { VscCloudUpload, VscTrash } from "react-icons/vsc";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { useCustomTranslations } from "./customTranslations";
import { parseBibleXml } from "./parseBibleXml";

const TranslationsModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;

  const { translations, refetch } = useCustomTranslations();
  const createMutation = trpc.bible.translations.create.useMutation();
  const removeMutation = trpc.bible.translations.remove.useMutation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setStatus("Reading file...");
    try {
      const text = await file.text();
      const fallbackName = file.name.replace(/\.[^.]+$/, "");

      setStatus("Parsing...");
      const parsed = parseBibleXml(text, fallbackName);

      setStatus(
        `Uploading "${parsed.name}" (${parsed.books.length} books, ${parsed.chapters.length} chapters)...`,
      );
      await createMutation.mutateAsync({
        pluginId,
        name: parsed.name,
        abbreviation: parsed.abbreviation,
        language: parsed.language,
        format: parsed.format,
        books: parsed.books,
        chapters: parsed.chapters,
      });

      await refetch();
      setStatus(`Added "${parsed.name}" (${parsed.books.length} books).`);
    } catch (err) {
      setError((err as Error).message || "Failed to import translation.");
      setStatus(null);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onRemove = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await removeMutation.mutateAsync({ pluginId, id });
      await refetch();
      setStatus(null);
    } catch (err) {
      setError((err as Error).message || "Failed to remove translation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="lg">
        <DialogHeader className="px-3 md:px-6">
          <DialogTitle>Your Translations</DialogTitle>
        </DialogHeader>
        <DialogBody className="px-3 md:px-6">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-secondary">
              Upload a Bible in XML format (Zefania, OpenSong, USX, OSIS, or
              Beblia). It is
              stored for your organization and becomes selectable in the search
              bar for everyone on your team. Only upload translations you have
              the rights to use.
            </p>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,application/xml,text/xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                }}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                data-testid="bible-upload-translation"
              >
                <VscCloudUpload />
                {busy ? "Working..." : "Upload XML"}
              </Button>
            </div>

            {status && <p className="text-sm text-secondary">{status}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Installed</p>
              {translations.length === 0 ? (
                <p className="text-sm text-secondary">
                  No translations uploaded yet.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-stroke border border-stroke rounded">
                  {translations.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-xs text-secondary">
                          {t.bookCount} books
                          {t.language ? ` · ${t.language}` : ""}
                        </p>
                      </div>
                      <PopConfirm
                        title={`Remove "${t.name}"?`}
                        onConfirm={() => onRemove(t.id)}
                        okText="Remove"
                        cancelText="Cancel"
                      >
                        <Button size="sm" variant="ghost" title="Remove" disabled={busy}>
                          <VscTrash />
                        </Button>
                      </PopConfirm>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter className="px-3 md:px-6 pb-3 justify-end">
          <Button variant="outline" onClick={onToggle}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TranslationsModal;
