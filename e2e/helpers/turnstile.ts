import type { Page } from "@playwright/test";

/**
 * Cloudflare's Turnstile widget never renders in the Playwright browser (the
 * challenge iframe is never injected), so any form gated on a captcha token
 * can't be submitted through the UI.
 *
 * Local/CI config uses Cloudflare's documented always-passes test keys
 * (site `1x00000000000000000000AA`, secret `1x0000...AA`), so we stub the
 * client widget to hand back a dummy token immediately. Server-side
 * verification is left completely untouched: the request still goes to
 * Cloudflare's siteverify and still has to pass.
 *
 * Must run before the app document loads, hence `addInitScript`.
 */
export const stubTurnstile = async (page: Page) => {
  await page.addInitScript(() => {
    const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

    (window as any).turnstile = {
      render: (
        _el: HTMLElement,
        params: { callback?: (token: string) => void },
      ) => {
        // Hand the token back asynchronously, mirroring the real widget.
        window.setTimeout(() => params.callback?.(DUMMY_TOKEN), 0);
        return "stub-widget-id";
      },
      reset: () => {},
      remove: () => {},
    };

    // Stop the real script from loading and clobbering the stub above.
    (window as any).__turnstileScriptPromise = Promise.resolve();
  });
};
