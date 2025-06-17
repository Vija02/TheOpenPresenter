import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import "./link.css";

const linkVariants = cva("ui--link", {
  variants: {
    variant: {
      default: "",
      unstyled: "text-inherit hover:no-underline",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Link({
  className,
  variant,
  asChild = false,
  isExternal,
  ...props
}: React.ComponentProps<"a"> &
  VariantProps<typeof linkVariants> & {
    asChild?: boolean;
  } & { isExternal?: boolean }) {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      data-slot="a"
      className={cn(linkVariants({ variant, className }))}
      {...(isExternal ? { target: "_blank", rel: "noopener" } : {})}
      {...props}
    />
  );
}

export { Link, linkVariants };
