import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Option,
  Progress,
} from "@repo/ui";
import { useMemo, useRef, useState } from "react";

export type PublishStage = "idle" | "building" | "uploading";

type BumpKind = "patch" | "minor" | "major" | "custom";

const parseSemver = (v: string): [number, number, number] => {
  const parts = v.split(".").map((p) => parseInt(p, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
};

export const bumpVersion = (
  current: string,
  kind: Exclude<BumpKind, "custom">,
) => {
  const [major, minor, patch] = parseSemver(current);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

const STAGE_PROGRESS: Record<PublishStage, number> = {
  idle: 0,
  building: 45,
  uploading: 80,
};

const STAGE_LABEL: Record<PublishStage, string> = {
  idle: "",
  building: "Compiling your plugin…",
  uploading: "Uploading artifacts…",
};

export const PublishPluginModal = ({
  latestVersion,
  takenVersions,
  stage,
  error,
  onPublish,
  onClose,
}: {
  // Highest published version, or null when nothing has been published yet.
  latestVersion: string | null;
  takenVersions: string[];
  stage: PublishStage;
  error: string | null;
  onPublish: (version: string) => void;
  onClose: () => void;
}) => {
  const [kind, setKind] = useState<BumpKind>("patch");
  const [custom, setCustom] = useState("");

  const liveBase = latestVersion ?? "0.0.0";
  const frozenBase = useRef(liveBase);
  if (stage === "idle") frozenBase.current = liveBase;
  const base = frozenBase.current;

  const resolved = useMemo(
    () => (kind === "custom" ? custom.trim() : bumpVersion(base, kind)),
    [base, custom, kind],
  );

  const isBusy = stage !== "idle";

  const isTaken = stage === "idle" && takenVersions.includes(resolved);
  const isValidShape = /^\d+\.\d+\.\d+$/.test(resolved);
  const canPublish = !isBusy && isValidShape && !isTaken;

  const options: { kind: Exclude<BumpKind, "custom">; hint: string }[] = [
    { kind: "patch", hint: "Fixes" },
    { kind: "minor", hint: "New features" },
    { kind: "major", hint: "Breaking changes" },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && !isBusy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish plugin</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {error && (
            <Alert
              variant="destructive"
              title="Publish failed"
              className="mb-4"
            >
              <pre className="whitespace-pre-wrap text-xs">{error}</pre>
            </Alert>
          )}

          <p className="text-sm text-secondary mb-3">
            {latestVersion
              ? `Currently published: ${latestVersion}`
              : "Nothing published yet."}
          </p>

          <div className="flex flex-col gap-2">
            {options.map((o) => {
              const next = bumpVersion(base, o.kind);
              return (
                <Option
                  key={o.kind}
                  selected={kind === o.kind}
                  disabled={isBusy}
                  onClick={() => setKind(o.kind)}
                  title={
                    <span className="flex items-center justify-between gap-3">
                      <span className="capitalize">{o.kind}</span>
                      <span className="font-mono font-normal text-sm">
                        {next}
                      </span>
                    </span>
                  }
                  description={o.hint}
                />
              );
            })}

            <Option
              selected={kind === "custom"}
              disabled={isBusy}
              onClick={() => setKind("custom")}
              title={
                <span className="flex items-center justify-between gap-3">
                  <span>Custom</span>
                  <input
                    className="border rounded px-2 py-1 w-28 text-sm font-mono font-normal"
                    placeholder="1.2.3"
                    value={custom}
                    disabled={isBusy}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setKind("custom");
                      setCustom(e.target.value);
                    }}
                  />
                </span>
              }
              description="Set an exact version"
            />
          </div>

          {kind === "custom" && custom.trim() !== "" && !isValidShape && (
            <p className="text-xs text-fill-destructive mt-2">
              Use a major.minor.patch version, e.g. 1.2.3
            </p>
          )}
          {isTaken && (
            <p className="text-xs text-fill-destructive mt-2">
              Version {resolved} already exists. Versions are immutable.
            </p>
          )}

          {stage !== "idle" && (
            <div className="mt-4">
              <Progress value={STAGE_PROGRESS[stage]} variant="info" />
              <p className="text-xs text-secondary mt-1">
                {STAGE_LABEL[stage]}
              </p>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <div className="flex gap-2">
            <Button
              variant="success"
              isLoading={isBusy}
              disabled={!canPublish}
              onClick={() => onPublish(resolved)}
            >
              Publish {isValidShape ? resolved : ""}
            </Button>
            <Button variant="outline" disabled={isBusy} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
