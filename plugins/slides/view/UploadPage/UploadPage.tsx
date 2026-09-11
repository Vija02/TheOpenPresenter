import { Alert, Input, LoadingInline } from "@repo/ui";
import { useRef, useState } from "react";
import { toast } from "react-toastify";

import { SlideDropArea } from "../components/SlideDropArea";
import { CurrentSlide } from "./CurrentSlide";
import { SourceButtons } from "./SourceButtons";
import { useUploadStatus } from "./useUploadStatus";

export type UploadPageConfig = {
  token: string;
  organizationName: string;
  label: string | null;
  accept: string;
  rejectionMessage: string | null;
  googleClientId: string;
  googleAppId: string;
  canvaEnabled: boolean;
};

export const UploadPage = ({ config }: { config: UploadPageConfig }) => {
  const { token, organizationName, label, accept } = config;

  const [name, setName] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { status, refresh } = useUploadStatus(token);

  const rejectionMessage = status
    ? status.rejectionMessage
    : config.rejectionMessage;
  const isSpent = Boolean(rejectionMessage);

  const send = async (run: () => Promise<Response>) => {
    setIsBusy(true);

    try {
      const res = await run();
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(body?.error ?? "Something went wrong.", {
          toastId: "slides--uploadError",
        });
        // A rejection may be the link running out, which the page must show.
        await refresh();
        return false;
      }

      toast.success("Your slides has been sent.", {
        toastId: "slides--uploadOk",
      });
      await refresh();
      return true;
    } catch {
      toast.error("Could not reach the server.", {
        toastId: "slides--uploadUnreachable",
      });
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const upload = async (file: File) => {
    if (isSpent) return;

    const form = new FormData();
    form.append("file", file);
    if (name.trim()) form.append("uploaderName", name.trim());

    const ok = await send(() =>
      fetch(`/plugin/slides/upload/${token}`, {
        method: "POST",
        headers: { "x-top-csrf-protection": "1" },
        body: form,
      }),
    );

    if (ok && fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (isBusy) return;

    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  return (
    <div className="min-h-screen flex justify-center px-4 py-6 md:py-10 bg-surface-primary text-primary">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Send your slides</h1>
          <p className="text-secondary">
            {label
              ? `${organizationName} asked for: ${label}`
              : `Upload slides for ${organizationName}.`}
          </p>
        </div>

        <CurrentSlide status={status} />

        {rejectionMessage && (
          <Alert
            variant="warning"
            title="No attempts left"
            data-testid="slides-upload-spent"
          >
            {rejectionMessage}
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="uploader-name">
            Your name (optional)
          </label>
          <Input
            id="uploader-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSpent}
          />
        </div>

        {isBusy ? (
          <div className="bg-link/5 rounded-xl border-2 border-dashed border-link/50 p-6 md:p-10 text-center text-link font-medium min-h-[250px] md:min-h-[400px] flex flex-col items-center justify-center gap-4">
            <LoadingInline className="size-10" />
            <span className="text-lg">Sending your slides...</span>
          </div>
        ) : (
          <div
            className={isSpent ? "opacity-50 pointer-events-none" : undefined}
            aria-disabled={isSpent || undefined}
            data-testid="slides-upload-dropzone"
            onClick={() => fileRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragActive(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragActive(false);
            }}
            onDrop={handleDrop}
          >
            <SlideDropArea
              title="Drop your slides here"
              isDragActive={isDragActive}
              headingLevel="h2"
            />

            <input
              id="uploader-file"
              type="file"
              ref={fileRef}
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </div>
        )}

        <span className="text-xs text-tertiary text-center">
          PDF, PowerPoint or images. Max 50MB. Uploading again replaces what you
          sent.
        </span>

        <SourceButtons
          config={config}
          uploaderName={name.trim()}
          isBusy={isBusy}
          isDisabled={isSpent}
          setBusy={setIsBusy}
          send={send}
        />
      </div>
    </div>
  );
};
