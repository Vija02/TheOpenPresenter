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
import "./textarea.css";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn("ui--textarea", className)}
      {...props}
    />
  );
}

function TextareaControl({
  control,
  name,
  label,
  labelSuffix,
  description,
  ...props
}: React.ComponentProps<"textarea"> & {
  name: string;
  label: string;
  labelSuffix?: React.ReactNode;
  description?: string;
  control: Control<any, any, any>;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {labelSuffix ? (
            <div className="flex items-center justify-between gap-2">
              <FormLabel>{label}</FormLabel>
              {labelSuffix}
            </div>
          ) : (
            <FormLabel>{label}</FormLabel>
          )}
          <FormControl>
            <Textarea {...field} {...props} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { Textarea, TextareaControl };
