import { cn } from "@/lib/utils";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import "./progress.css";

const progressVariants = cva("ui--progress", {
  variants: {
    variant: {
      default: "ui--progress__default",
      success: "ui--progress__success",
      info: "ui--progress__info",
      warning: "ui--progress__warning",
      destructive: "ui--progress__destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Progress({
  className,
  variant,
  value,
  ...props
}: VariantProps<typeof progressVariants> &
  React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(progressVariants({ variant }), className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
