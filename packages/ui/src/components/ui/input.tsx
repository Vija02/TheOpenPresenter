import { cn } from "@/lib/utils";
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
import "./input.css";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn("ui--input", className)}
      {...props}
    />
  );
}

function InputControl({
  control,
  name,
  label,
  description,
  ...props
}: React.ComponentProps<"input"> & {
  name: string;
  label: string;
  description?: string;
  control: Control<any, any, any>;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} {...props} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { Input, InputControl };
