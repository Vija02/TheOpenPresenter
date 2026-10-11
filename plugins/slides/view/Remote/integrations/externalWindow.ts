import { desktop } from "@repo/desktop-bridge";

/**
 * Sign-ins and pickers that run on the cloud open in a real browser: Google
 * and Canva refuse to run inside the desktop shell or on a localhost origin.
 *
 * Call `claimExternalWindow` before any await. A plain browser blocks windows
 * opened after one, so it claims a blank window up front; the desktop shell
 * opens the system browser instead and needs nothing claimed.
 */
export const claimExternalWindow = (): Window | null =>
  desktop.isDesktop ? null : window.open("about:blank", "_blank");

/** Sends a claimed window (or the system browser) to `url`. */
export const openExternally = async (claimed: Window | null, url: string) => {
  if (claimed) {
    claimed.location.href = url;
  } else {
    await desktop.openExternal(url);
  }
};
