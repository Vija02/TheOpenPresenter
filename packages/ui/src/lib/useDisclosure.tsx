"use client";

import { useCallback, useState } from "react";

import { useCallbackRef } from "./useCallbackRef";

export interface UseDisclosureProps {
  open?: boolean;
  defaultOpen?: boolean;
  onClose?(): void;
  onOpen?(): void;
}

export function useDisclosure(props: UseDisclosureProps = {}) {
  const handleOpen = useCallbackRef(props.onOpen);
  const handleClose = useCallbackRef(props.onClose);

  const [openState, setOpen] = useState(props.defaultOpen || false);

  const open = props.open !== undefined ? props.open : openState;
  const controlled = props.open !== undefined;

  const onClose = useCallback(() => {
    if (!controlled) setOpen(false);
    handleClose?.();
  }, [controlled, handleClose]);

  const onOpen = useCallback(() => {
    if (!controlled) setOpen(true);
    handleOpen?.();
  }, [controlled, handleOpen]);

  const onToggle = useCallback(() => {
    if (open) {
      onClose();
    } else {
      onOpen();
    }
  }, [open, onOpen, onClose]);

  return {
    open,
    onOpen,
    onClose,
    onToggle,
    setOpen,
  };
}

export type UseDisclosureReturn = ReturnType<typeof useDisclosure>;
