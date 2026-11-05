import {
  Button,
  Input,
  LoadingInline,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui";
import { FormEvent, ReactNode, useState } from "react";
import { FaLink } from "react-icons/fa6";

/** A pasted share link. `onSubmit` throws to show its message. */
export type PublicLinkConfig = {
  title: string;
  description: ReactNode;
  placeholder: string;
  /** Shown greyed out, with this as the reason on hover */
  disabledReason?: string;
  /** Checks the link before anything is sent; throws with what's wrong */
  validate?: (url: string) => void;
  onSubmit: (url: string) => Promise<void> | void;
};

/**
 * A chooser row that opens into a link field. Starts open when it's the only
 * way in, so there's nothing to click first.
 */
export const PublicLinkOption = ({
  config,
  defaultOpen = false,
}: {
  config: PublicLinkConfig;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (config.disabledReason) {
    return (
      <Tooltip>
        {/* Not a disabled <button>: those swallow the hover the tooltip needs */}
        <TooltipTrigger asChild>
          <div
            role="button"
            aria-disabled="true"
            tabIndex={0}
            className="flex items-start gap-3 text-left cursor-not-allowed border border-stroke rounded-sm p-3 opacity-50"
            data-testid="slides-public-link-option"
          >
            <span className="mt-0.5 shrink-0 text-secondary">
              <FaLink className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block font-medium">{config.title}</span>
              <span className="block text-xs text-secondary">
                {config.description}
              </span>
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {config.disabledReason}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-start gap-3 text-left cursor-pointer border border-stroke rounded-sm p-3 hover:border-blue-400 hover:bg-surface-primary-hover"
        data-testid="slides-public-link-option"
      >
        <span className="mt-0.5 shrink-0 text-secondary">
          <FaLink className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">{config.title}</span>
          <span className="block text-xs text-secondary">
            {config.description}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-start gap-3 border border-blue-400 rounded-sm p-3">
      <span className="mt-0.5 shrink-0 text-secondary">
        <FaLink className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block font-medium">{config.title}</span>
        <span className="block text-xs text-secondary mb-2">
          {config.description}
        </span>
        <PublicLinkForm config={config} autoFocus />
      </div>
    </div>
  );
};

export const PublicLinkForm = ({
  config,
  autoFocus,
}: {
  config: PublicLinkConfig;
  autoFocus?: boolean;
}) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const trimmed = url.trim();
    if (!trimmed || isSubmitting) return;

    setError(null);
    try {
      config.validate?.(trimmed);
    } catch (err: any) {
      setError(err?.message ?? "That link doesn't look right.");
      return;
    }

    setIsSubmitting(true);
    try {
      await config.onSubmit(trimmed);
      setUrl("");
    } catch (err: any) {
      setError(err?.message ?? "Could not import from that link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder={config.placeholder}
          autoFocus={autoFocus}
          disabled={isSubmitting}
          className="flex-1 min-w-0"
          data-testid="slides-public-link-input"
        />
        <Button
          type="submit"
          disabled={!url.trim() || isSubmitting}
          data-testid="slides-public-link-submit"
        >
          {isSubmitting ? <LoadingInline className="size-4" /> : "Import"}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </form>
  );
};
