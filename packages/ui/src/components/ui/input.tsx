import { cn } from "@/lib/utils";
import * as React from "react";
import { Control } from "react-hook-form";
import { FiEye, FiEyeOff } from "react-icons/fi";

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

function PasswordInput({ className, ...props }: React.ComponentProps<"input">) {
  const [isRevealed, setIsRevealed] = React.useState(false);

  return (
    <div className="relative w-full">
      <Input
        {...props}
        type={isRevealed ? "text" : "password"}
        className={cn("pr-9", className)}
      />
      <button
        type="button"
        onClick={() => setIsRevealed((x) => !x)}
        aria-label={isRevealed ? "Hide password" : "Show password"}
        aria-pressed={isRevealed}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-tertiary hover:text-secondary cursor-pointer"
      >
        {isRevealed ? (
          <FiEyeOff className="size-4" />
        ) : (
          <FiEye className="size-4" />
        )}
      </button>
    </div>
  );
}

function InputControl({
  control,
  name,
  label,
  labelSuffix,
  description,
  ...props
}: React.ComponentProps<"input"> & {
  name: string;
  label: string;
  labelSuffix?: React.ReactNode;
  description?: string;
  control: Control<any, any, any>;
}) {
  const Comp = props.type === "password" ? PasswordInput : Input;

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
            <Comp {...field} {...props} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { Input, PasswordInput, InputControl };
