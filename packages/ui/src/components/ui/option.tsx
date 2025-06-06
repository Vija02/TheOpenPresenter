import { cn } from "@/lib/utils";
import { Control } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import "./option.css";

export interface OptionItem<Value = string> {
  title: string;
  description?: string;
  value: Value;
  disabled?: boolean;
}

interface OptionProps {
  title: string;
  description?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

function Option({
  title,
  description,
  selected,
  disabled,
  onClick,
  className,
}: OptionProps) {
  return (
    <div
      className={cn(
        "ui--option",
        selected && "ui--option--selected",
        disabled && "ui--option--disabled",
        className,
      )}
      onClick={disabled ? undefined : onClick}
    >
      <p className="ui--option__title">{title}</p>
      {description && <p className="ui--option__description">{description}</p>}
    </div>
  );
}

interface OptionGroupProps<Value = string> {
  options: OptionItem<Value>[];
  value?: Value;
  onValueChange?: (value: Value) => void;
  disabled?: boolean;
  className?: string;
}

function OptionGroup<Value = string>({
  options,
  value,
  onValueChange,
  disabled,
  className,
}: OptionGroupProps<Value>) {
  return (
    <div className={cn("ui--option-group", className)}>
      {options.map((option, index) => (
        <Option
          key={index}
          title={option.title}
          description={option.description}
          selected={value === option.value}
          disabled={disabled ?? option.disabled}
          onClick={() => onValueChange?.(option.value)}
        />
      ))}
    </div>
  );
}

interface OptionControlProps<Value = string> {
  control: Control<any, any, any>;
  name: string;
  label: string;
  description?: string;
  options: OptionItem<Value>[];
  disabled?: boolean;
  className?: string;
}

function OptionControl<Value = string>({
  control,
  name,
  label,
  description,
  options,
  className,
}: OptionControlProps<Value>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <OptionGroup<Value>
              options={options}
              value={field.value}
              onValueChange={field.onChange}
              disabled={field.disabled}
              className={className}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { Option, OptionGroup, OptionControl };
