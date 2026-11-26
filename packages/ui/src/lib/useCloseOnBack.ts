import type { Dialog } from "@base-ui/react/dialog";
import * as React from "react";

import { useIsMobile } from "./useIsMobile";

const KEY = "__overlay";
/** Entries owned by dialogs that are open right now */
const active = new Set<string>();

/**
 * On phones, the back button closes an open dialog or sheet instead of leaving the page
 */
export const useCloseOnBack = (
  open: boolean | undefined,
  close: () => void,
) => {
  const isMobile = useIsMobile();
  const closeRef = React.useRef(close);
  closeRef.current = close;

  React.useEffect(() => {
    if (!open || !isMobile) return;

    const marker = Math.random().toString(36).slice(2);
    const state = { ...window.history.state, [KEY]: marker };
    const current = window.history.state?.[KEY];
    // Reuse an entry nothing owns any more (e.g. left by a remount) rather than stack another
    if (current && !active.has(current)) window.history.replaceState(state, "");
    else window.history.pushState(state, "");
    active.add(marker);

    let closedByBack = false;
    const onPopState = () => {
      // Back from a dialog opened on top of this one lands back on our entry
      if (window.history.state?.[KEY] === marker) return;
      closedByBack = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      active.delete(marker);
      window.removeEventListener("popstate", onPopState);
      if (closedByBack) return;
      // Deferred, and only if our entry is still on top: closing then navigating
      // must not take the user back a page
      setTimeout(() => {
        if (window.history.state?.[KEY] === marker) window.history.back();
      });
    };
  }, [open, isMobile]);
};

/** What a dialog's `onOpenChange` gets when back closed it */
export const backDetails = (): Dialog.Root.ChangeEventDetails => ({
  reason: "none",
  event: new Event("popstate"),
  cancel: () => {},
  allowPropagation: () => {},
  isCanceled: false,
  isPropagationAllowed: false,
  trigger: undefined,
  preventUnmountOnClose: () => {},
});
