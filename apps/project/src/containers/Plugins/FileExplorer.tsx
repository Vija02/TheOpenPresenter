import { Badge, Button, PopConfirm } from "@repo/ui";
import { useCallback, useMemo, useState } from "react";

import { isRequired, sortFiles, validateFilename } from "./pluginFiles";
import { Plugin, PluginVersion } from "./types";

export const FileExplorer = ({
  files,
  activeFile,
  onSelectFile,
  onFilesChange,
  onDeleteFile,
  versions,
  latestVersionId,
}: {
  files: Record<string, string>;
  activeFile: string;
  onSelectFile: (name: string) => void;
  onFilesChange: (
    update: (prev: Record<string, string>) => Record<string, string>,
  ) => void;
  onDeleteFile: (name: string) => void;
  versions: PluginVersion[];
  latestVersionId: Plugin["latestVersionId"];
}) => {
  const [action, setAction] = useState<"add" | "rename" | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const fileNames = useMemo(() => sortFiles(Object.keys(files)), [files]);

  const closeAction = useCallback(() => {
    setAction(null);
    setPendingName("");
    setNameError(null);
  }, []);

  const onAdd = useCallback(() => {
    const error = validateFilename(pendingName, Object.keys(files));
    if (error) {
      setNameError(error);
      return;
    }
    const name = pendingName.trim();
    onFilesChange((prev) => ({ ...prev, [name]: "" }));
    onSelectFile(name);
    closeAction();
  }, [closeAction, files, onFilesChange, onSelectFile, pendingName]);

  const onRename = useCallback(() => {
    const name = pendingName.trim();
    if (name === activeFile) {
      closeAction();
      return;
    }
    const error = validateFilename(pendingName, Object.keys(files));
    if (error) {
      setNameError(error);
      return;
    }
    onFilesChange((prev) => {
      const next: Record<string, string> = {};
      // Rebuild in order so the renamed file keeps its position.
      for (const [key, value] of Object.entries(prev)) {
        if (key === activeFile) next[name] = value;
        else next[key] = value;
      }
      return next;
    });
    onSelectFile(name);
    closeAction();
  }, [
    activeFile,
    closeAction,
    files,
    onFilesChange,
    onSelectFile,
    pendingName,
  ]);

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r bg-surface-primary">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-2xs font-semibold uppercase tracking-wide text-secondary">
          Files
        </span>
        <button
          type="button"
          title="New file"
          aria-label="New file"
          className="text-secondary hover:text-primary hover:bg-surface-secondary-hover rounded cursor-pointer leading-none px-1.5 py-0.5"
          onClick={() => {
            setAction("add");
            setPendingName("");
            setNameError(null);
          }}
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {fileNames.map((f) => {
          const isActive = activeFile === f;
          return (
            <div
              key={f}
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelectFile(f);
                closeAction();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectFile(f);
                  closeAction();
                }
              }}
              onDoubleClick={() => {
                if (isRequired(f)) return;
                onSelectFile(f);
                setAction("rename");
                setPendingName(f);
                setNameError(null);
              }}
              className={`group flex items-center justify-between gap-1 px-3 py-1 cursor-pointer text-sm ${
                isActive
                  ? "bg-surface-secondary font-medium border-l-2 border-l-accent"
                  : "border-l-2 border-l-transparent hover:bg-surface-secondary-hover"
              }`}
            >
              <span className="truncate font-mono text-xs">{f}</span>
              {!isRequired(f) && (
                <PopConfirm
                  title={`Delete ${f}?`}
                  description="Any file importing it will fail to build."
                  onConfirm={() => onDeleteFile(f)}
                  okText="Delete"
                  cancelText="Cancel"
                >
                  <button
                    type="button"
                    aria-label={`Delete ${f}`}
                    title={`Delete ${f}`}
                    className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 text-secondary hover:text-fill-destructive hover:bg-surface-secondary-hover rounded cursor-pointer text-xs px-1 leading-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ✕
                  </button>
                </PopConfirm>
              )}
            </div>
          );
        })}

        {action && (
          <div className="px-2 py-2 border-t mt-1">
            <input
              autoFocus
              className="border rounded px-2 py-1 text-xs font-mono w-full"
              placeholder="component.tsx"
              value={pendingName}
              onChange={(e) => {
                setPendingName(e.target.value);
                setNameError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (action === "add") onAdd();
                  else onRename();
                }
                if (e.key === "Escape") closeAction();
              }}
            />
            {nameError && (
              <p className="text-2xs text-fill-destructive mt-1">{nameError}</p>
            )}
            <div className="flex gap-1 mt-1">
              <Button size="xs" onClick={action === "add" ? onAdd : onRename}>
                {action === "add" ? "Create" : "Rename"}
              </Button>
              <Button size="xs" variant="ghost" onClick={closeAction}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {versions.length > 0 && (
        <div className="border-t shrink-0 flex flex-col max-h-48">
          <div className="px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-secondary shrink-0">
            Versions
          </div>
          <div className="flex flex-col gap-1 px-3 pb-2 overflow-y-auto">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center gap-1.5">
                <span className="font-mono text-xs">{v.version}</span>
                <Badge size="sm">{v.buildStatus}</Badge>
                {latestVersionId === v.id && <Badge size="sm">latest</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
