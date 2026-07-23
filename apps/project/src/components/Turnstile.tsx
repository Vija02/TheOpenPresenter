import { appData } from "@repo/lib";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileParams = {
  sitekey: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  appearance?: "always" | "execute" | "interaction-only";
};

type TurnstileApi = {
  render: (el: HTMLElement, params: TurnstileParams) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __turnstileScriptPromise?: Promise<void>;
  }
}

export const getTurnstileSiteKey = (): string | undefined =>
  appData.getTurnstileSiteKey();

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (window.__turnstileScriptPromise) {
    return window.__turnstileScriptPromise;
  }
  window.__turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });
  return window.__turnstileScriptPromise;
}

export type TurnstileRef = {
  /** Reset the widget, clearing the current token (e.g. after a failed submit). */
  reset: () => void;
};

type TurnstileProps = {
  /** Called with a fresh token on success, or `null` when it expires/errors. */
  onToken: (token: string | null) => void;
  className?: string;
  theme?: "light" | "dark" | "auto";
};

/**
 * Cloudflare Turnstile widget.
 *
 * Renders nothing when no site key is configured (captcha disabled), so the
 * surrounding form keeps working in local/self-hosted setups without Turnstile.
 */
export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
  function Turnstile({ onToken, className, theme = "auto" }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    const siteKey = getTurnstileSiteKey();

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          if (window.turnstile && widgetIdRef.current) {
            window.turnstile.reset(widgetIdRef.current);
          }
          onTokenRef.current(null);
        },
      }),
      [],
    );

    useEffect(() => {
      if (!siteKey) {
        return;
      }

      let cancelled = false;

      loadTurnstileScript()
        .then(() => {
          if (
            cancelled ||
            !containerRef.current ||
            !window.turnstile ||
            widgetIdRef.current
          ) {
            return;
          }
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            callback: (token) => onTokenRef.current(token),
            "expired-callback": () => onTokenRef.current(null),
            "error-callback": () => onTokenRef.current(null),
            "timeout-callback": () => onTokenRef.current(null),
          });
        })
        .catch((e) => {
          console.error(e);
        });

      return () => {
        cancelled = true;
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
        }
        widgetIdRef.current = null;
      };
    }, [siteKey, theme]);

    if (!siteKey) {
      return null;
    }

    return <div ref={containerRef} className={className} />;
  },
);
