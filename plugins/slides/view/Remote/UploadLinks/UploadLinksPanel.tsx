import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Form,
  Input,
  InputControl,
  LoadingInline,
  NumberInputControl,
  PopConfirm,
  SelectControl,
} from "@repo/ui";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FaCopy, FaLink, FaTrash } from "react-icons/fa6";

import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";

type ExpiresIn = "never" | "1d" | "7d" | "30d";

type CreateLinkForm = {
  label: string;
  maxAttempts: number;
  expiresIn: ExpiresIn;
};

const EXPIRY_OPTIONS: { label: string; value: ExpiresIn }[] = [
  { label: "Never", value: "never" },
  { label: "In 1 day", value: "1d" },
  { label: "In 7 days", value: "7d" },
  { label: "In 30 days", value: "30d" },
];

const EXPIRY_DAYS: Partial<Record<ExpiresIn, number>> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
};

/** Create and manage public upload links for this slides scene. */
export const UploadLinksPanel = () => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const toast = pluginApi.remote.toast;

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.slides.listUploadLinks.useQuery({
    pluginId,
  });
  const { mutateAsync: createLink, isPending: isCreating } =
    trpc.slides.createUploadLink.useMutation();
  const { mutateAsync: revokeLink } =
    trpc.slides.revokeUploadLink.useMutation();

  const form = useForm<CreateLinkForm>({
    defaultValues: { label: "", maxAttempts: 3, expiresIn: "never" },
  });

  const urlFor = (token: string) => `${data?.baseUrl ?? ""}/${token}`;

  const handleCreate = async ({
    label,
    maxAttempts,
    expiresIn,
  }: CreateLinkForm) => {
    try {
      const days = EXPIRY_DAYS[expiresIn];

      await createLink({
        pluginId,
        label: label.trim() || undefined,
        maxAttempts: maxAttempts > 0 ? maxAttempts : undefined,
        expiresAt: days
          ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
      });

      form.reset({ label: "", maxAttempts, expiresIn });
      await refetch();
    } catch (err: any) {
      toast.error(`Couldn't create the link: ${err?.message ?? err}`, {
        toastId: "slides--uploadLinkCreateError",
      });
    }
  };

  const handleCopy = async (id: string, token: string) => {
    try {
      await navigator.clipboard.writeText(urlFor(token));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Couldn't copy. You can select the link and copy it.", {
        toastId: "slides--uploadLinkCopyError",
      });
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeLink({ pluginId, id });
      await refetch();
    } catch (err: any) {
      toast.error(`Couldn't turn off the link: ${err?.message ?? err}`, {
        toastId: "slides--uploadLinkRevokeError",
      });
    }
  };

  if (isLoading) return <LoadingInline />;

  const links = data?.links ?? [];
  const uploads = data?.uploads ?? [];
  const activeLinks = links.filter((x: any) => x.is_active);

  return (
    <div className="flex flex-col gap-5">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleCreate)}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1">
              <InputControl
                control={form.control}
                name="label"
                label="What's this link for? (optional)"
                placeholder="e.g. Sunday guest speaker"
              />
            </div>

            <Button
              type="submit"
              variant="success"
              isLoading={isCreating}
              data-testid="slides-create-upload-link"
            >
              <FaLink /> Create link
            </Button>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="advanced" className="border-0">
              <AccordionTrigger className="py-1 text-sm">
                Advanced
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <NumberInputControl
                      control={form.control}
                      name="maxAttempts"
                      label="Upload attempts"
                      description="They can replace their slide until attempts run out."
                      min={1}
                      max={99}
                      step={1}
                    />
                  </div>

                  <div className="flex-1">
                    <SelectControl
                      control={form.control}
                      name="expiresIn"
                      label="Expires"
                      options={EXPIRY_OPTIONS}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </form>
      </Form>

      {activeLinks.length === 0 && (
        <p className="text-sm text-tertiary">No active links yet.</p>
      )}

      {activeLinks.map((link: any) => (
        <div
          key={link.id}
          className="border border-stroke rounded-lg p-3 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm">
              {link.label || "Upload link"}
            </span>
            <PopConfirm
              title="Turn off this link? Anyone holding it will no longer be able to upload."
              onConfirm={() => handleRevoke(link.id)}
              okText="Turn off"
              cancelText="Keep"
            >
              <Button
                size="sm"
                variant="ghost"
                data-testid="slides-revoke-upload-link"
              >
                <FaTrash />
              </Button>
            </PopConfirm>
          </div>

          <div className="flex gap-2 items-center">
            <Input
              readOnly
              data-testid="slides-upload-link-url"
              className="flex-1 text-xs"
              value={urlFor(link.token)}
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button size="sm" onClick={() => handleCopy(link.id, link.token)}>
              <FaCopy /> {copiedId === link.id ? "Copied" : "Copy"}
            </Button>
          </div>

          {link.current_thumbnail_media_names?.length ? (
            <div className="flex flex-col gap-2 bg-surface-secondary rounded-md p-2">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">
                  {link.current_original_name ?? "Slide"}
                </span>
                <span className="text-xs text-tertiary truncate">
                  {link.current_uploader_name
                    ? `from ${link.current_uploader_name}`
                    : "from an anonymous visitor"}
                  {link.current_thumbnail_media_names.length > 1
                    ? `, ${link.current_thumbnail_media_names.length} slides`
                    : ""}
                </span>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {link.current_thumbnail_media_names.map(
                  (mediaName: string, i: number) => (
                    <img
                      key={`${mediaName}-${i}`}
                      src={`/media/data/${mediaName}`}
                      alt=""
                      className="h-16 aspect-[4/3] object-cover rounded border border-stroke shrink-0"
                    />
                  ),
                )}
              </div>
            </div>
          ) : (
            <span className="text-xs text-tertiary">Nothing received yet.</span>
          )}

          <span className="text-xs text-tertiary">
            {link.max_attempts
              ? `${link.attempts_used} of ${link.max_attempts} attempts used`
              : `${link.attempts_used} uploads, no limit`}
            {link.expires_at
              ? `, expires ${new Date(link.expires_at).toLocaleDateString()}`
              : ""}
          </span>
        </div>
      ))}

      {uploads.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-sm">Received</span>
          {uploads.map((upload: any) => (
            <div
              key={upload.id}
              className="flex justify-between text-xs border-b border-stroke py-1"
            >
              <span>{upload.original_name}</span>
              <span className="text-tertiary">
                {upload.uploader_name || "Anonymous"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
