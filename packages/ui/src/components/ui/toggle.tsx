"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

import "./toggle.css"

const toggleVariants = cva("ui--toggle", {
  variants: {
    size: {
      default: "ui--toggle__default",
      sm: "ui--toggle__sm",
      lg: "ui--toggle__lg",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

function Toggle({
  className,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
