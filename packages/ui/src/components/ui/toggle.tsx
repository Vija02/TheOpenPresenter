"use client";

import { cn } from "@/lib/utils";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { Control } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import "./toggle.css";

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
});

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
  );
}

function ToggleControl({
  control,
  name,
  label,
  description,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    name: string;
    label: string;
    description?: string;
    control: Control<any, any, any>;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: { value, onChange, ...field } }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div>
              <Toggle
                pressed={value}
                onPressedChange={onChange}
                {...field}
                {...props}
              />
            </div>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { Toggle, ToggleControl, toggleVariants };
