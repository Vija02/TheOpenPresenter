import { cn } from "@/lib/utils";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
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
import "./toggle-group.css";

const ToggleGroupContext = React.createContext<{
  size?: "default" | "sm" | "lg";
}>({
  size: "default",
});

function ToggleGroup({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & {
  size?: "default" | "sm" | "lg";
}) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-size={size}
      className={cn("ui--toggle-group", className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className,
  children,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & {
  size?: "default" | "sm" | "lg";
}) {
  const context = React.useContext(ToggleGroupContext);
  const itemSize = context.size || size || "default";

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-size={itemSize}
      className={cn(
        "ui--toggle-group-item",
        `ui--toggle-group-item__${itemSize}`,
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

function ToggleGroupControl({
  control,
  name,
  label,
  description,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & {
  name: string;
  label: string;
  description?: string;
  control: Control<any, any, any>;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <ToggleGroup {...field} {...props}>
              {children}
            </ToggleGroup>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { ToggleGroup, ToggleGroupItem, ToggleGroupControl };
