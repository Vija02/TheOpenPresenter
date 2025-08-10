import { cx } from "class-variance-authority";
import React, { useCallback, useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";

import { Button } from "./components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import { useDisclosure } from "./lib/useDisclosure";

export interface PopConfirmProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  popoverProps?: React.ComponentProps<typeof PopoverContent>;
  onConfirm?: (e?: React.MouseEvent<HTMLElement>) => void;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  okButtonProps?: React.ComponentProps<typeof Button>;
  cancelButtonProps?: React.ComponentProps<typeof Button>;
  children?: React.ReactNode;
}

export function PopConfirm({
  title = "This is a destructive action",
  description = "Are you sure you want to continue?",
  popoverProps,
  onConfirm,
  okText = "Yes",
  cancelText = "Cancel",
  okButtonProps,
  cancelButtonProps,
  children,
}: PopConfirmProps) {
  const { open, onToggle } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = useCallback(
    async (e: React.MouseEvent<HTMLElement>) => {
      try {
        setIsLoading(true);
        await onConfirm?.(e);
        onToggle();
      } catch (e) {
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [onConfirm, onToggle],
  );
  const handleOnClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (e.shiftKey) {
        onToggle();
        handleConfirm(e);
      }
    },
    [],
  );

  return (
    <Popover open={open} onOpenChange={onToggle}>
      <PopoverTrigger asChild onClick={handleOnClick}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        {...popoverProps}
        className={cx(
          "border border-fill-destructive fill-fill-destructive stack-col text-center",
          popoverProps?.className,
        )}
      >
        <div className="stack-row pr-3">
          <FiAlertTriangle className="text-fill-destructive" />{" "}
          <p className="font-bold">{title}</p>
        </div>
        <p>{description}</p>

        <div className="stack-row justify-center">
          <PopoverClose asChild>
            <Button variant="outline" {...cancelButtonProps}>
              {cancelText}
            </Button>
          </PopoverClose>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            isLoading={isLoading}
            {...okButtonProps}
          >
            {okText}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
