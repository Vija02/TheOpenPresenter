import { LoadingInline } from "@/Loading/LoadingInline";
import { cn } from "@/lib/utils";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import "./button.css";

const buttonVariants = cva("ui--button", {
  variants: {
    variant: {
      default: "ui--button__default",
      success: "ui--button__success",
      info: "ui--button__info",
      warning: "ui--button__warning",
      destructive: "ui--button__destructive",
      outline: "ui--button__outline",
      muted: "ui--button__muted",
      ghost: "ui--button__ghost",
      pill: "ui--button__pill",
      link: "ui--button__link",
    },
    size: {
      default: "h-9 px-4 py-2 has-[>svg]:px-3",
      mini: "h-initial text-2xs py-2 rounded-sm gap-1 px-1.5 has-[>svg]:px-2.5 flex flex-col",
      xs: "h-6 rounded-sm gap-1.5 px-2 text-xs has-[>svg]:px-1 [&_svg:not([class*='size-'])]:size-3",
      sm: "h-8 rounded-sm gap-1.5 px-3 has-[>svg]:px-2.5",
      lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
      icon: "size-9",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

function Button({
  className,
  variant,
  size,
  isSelected,
  isLoading,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  } & { isSelected?: boolean; isLoading?: boolean }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      type="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...(isLoading ? { disabled: true } : {})}
      {...props}
    >
      {isLoading && <LoadingInline data-slot="loading" />}
      <Slottable>{props.children}</Slottable>
    </Comp>
  );
}

export { Button, buttonVariants };
