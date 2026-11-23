import { cn } from "@/lib/utils";
import { Time } from "@internationalized/date";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { DateInput, DateSegment, TimeField } from "react-aria-components";
import { Control } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import "./timeInput.css";

const parseTime = (value?: string | null) => {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  return match ? new Time(Number(match[1]), Number(match[2])) : null;
};

const formatTime = (time: { hour: number; minute: number }) =>
  `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;

export type TimeInputProps = {
  /** "HH:mm", or "" when empty */
  value?: string | null;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  disabled?: boolean;
  className?: string;
  /** Minutes between suggestions in the dropdown */
  step?: number;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

function TimeInput({
  value,
  onChange,
  onBlur,
  name,
  disabled,
  className,
  step = 15,
  "aria-invalid": invalid,
  ...aria
}: TimeInputProps) {
  const [open, setOpen] = React.useState(false);
  const selectedRef = React.useRef<HTMLButtonElement>(null);
  const time = parseTime(value);

  const formatter = React.useMemo(
    () => new Intl.DateTimeFormat(undefined, { timeStyle: "short" }),
    [],
  );
  const suggestions = React.useMemo(
    () =>
      Array.from({ length: Math.ceil(1440 / step) }, (_, i) => {
        const minutes = i * step;
        return formatTime({
          hour: Math.floor(minutes / 60),
          minute: minutes % 60,
        });
      }),
    [step],
  );
  // Highlight the exact match, or the closest earlier slot
  const current = value
    ? ([...suggestions].reverse().find((s) => s <= value) ?? suggestions[0])
    : "09:00";

  return (
    <div className={cn("ui--time-input", className)} data-disabled={disabled}>
      <TimeField
        {...aria}
        value={time}
        onChange={(t) => onChange?.(t ? formatTime(t) : "")}
        onBlur={onBlur}
        name={name}
        isDisabled={disabled}
        isInvalid={invalid}
        shouldForceLeadingZeros
        className="ui--time-input__field"
      >
        <DateInput className="ui--time-input__segments">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="ui--time-input__segment"
            />
          )}
        </DateInput>
      </TimeField>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Pick a time"
            className="ui--time-input__trigger"
          >
            <ChevronDown className="size-4 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          hideArrow
          hideCloseButton
          className="ui--time-input__list"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            selectedRef.current?.focus();
            selectedRef.current?.scrollIntoView({ block: "center" });
          }}
        >
          <div role="listbox" aria-label="Times">
            {suggestions.map((s) => (
              <button
                key={s}
                ref={s === current ? selectedRef : undefined}
                type="button"
                role="option"
                aria-selected={s === value}
                className="ui--time-input__option"
                onClick={() => {
                  onChange?.(s);
                  setOpen(false);
                }}
              >
                {formatter.format(
                  new Date(
                    2000,
                    0,
                    1,
                    ...(s.split(":").map(Number) as [number, number]),
                  ),
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function TimeInputControl({
  control,
  name,
  label,
  description,
  ...props
}: Omit<TimeInputProps, "value" | "onChange" | "name"> & {
  name: string;
  label: string;
  description?: string;
  control: Control<any, any, any>;
  onChange?: (value: string) => void;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <TimeInput
              aria-label={label}
              {...props}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(v) => {
                field.onChange(v);
                props.onChange?.(v);
              }}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { TimeInput, TimeInputControl };
