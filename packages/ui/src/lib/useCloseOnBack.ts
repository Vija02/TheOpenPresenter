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

const isTyping = () => {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement)
    return ![
      "checkbox",
      "radio",
      "button",
      "submit",
      "range",
      "color",
      "file",
    ].includes(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
};

type OpenChange = (
  open: boolean,
  details: Dialog.Root.ChangeEventDetails,
) => void;

/**
 * A dialog's open state, tracked here when the caller leaves it to a trigger
 * button, so back can close those too
 */
export const useOverlayOpen = ({
  open,
  defaultOpen,
  onOpenChange,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: OpenChange;
}) => {
  const isMobile = useIsMobile();
  const [ownOpen, setOwnOpen] = React.useState(defaultOpen ?? false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : ownOpen;
  // Checked as the press starts: some browsers move focus before we hear of it
  const typingAtPress = React.useRef(false);
  React.useEffect(() => {
    if (!isOpen || !isMobile) return;
    const onPress = () => {
      typingAtPress.current = isTyping();
    };
    document.addEventListener("pointerdown", onPress, true);
    return () => document.removeEventListener("pointerdown", onPress, true);
  }, [isOpen, isMobile]);

  const change: OpenChange = (next, details) => {
    // On phones, a tap outside first just puts the keyboard away
    if (
      !next &&
      isMobile &&
      details.reason === "outside-press" &&
      typingAtPress.current
    ) {
      typingAtPress.current = false;
      details.cancel();
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    if (!controlled) setOwnOpen(next);
    onOpenChange?.(next, details);
  };
  useCloseOnBack(isOpen, () => change(false, backDetails()));
  return { open: isOpen, onOpenChange: change };
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
