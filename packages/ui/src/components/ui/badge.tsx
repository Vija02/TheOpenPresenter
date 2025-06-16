import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import "./badge.css";

const badgeVariants = cva("ui--badge", {
  variants: {
    variant: {
      default: "bg-fill-default text-fill-default-fg",
      success: "bg-fill-success text-fill-success-fg",
      destructive: "bg-fill-destructive text-fill-destructive-fg",
      info: "bg-fill-info text-fill-info-fg",
      warning: "bg-fill-warning text-fill-warning-fg",
    },
    size: {
      default: "ui--badge__default",
      sm: "ui--badge__sm",
      lg: "ui--badge__lg",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
