import { formatHumanReadableDate } from "@/DateDisplay";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { Control } from "react-hook-form";
import { MenuListProps } from "react-select";

import "./dateInput.css";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import { Select } from "./select";

export type DateInputProps = {
  value?: Date | null;
  onChange?: (value: Date | undefined) => void;
  onBlur?: () => void;
  name?: string;
  disabled?: boolean;
  className?: string;
  /** Whether the date can be removed; defaults to true */
  clearable?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/** The dropdown is a calendar rather than a list of options */
const CalendarMenu = (props: MenuListProps<any, false>) => {
  const { value, onChange, onMenuClose } = props.selectProps;
  return (
    <ReactCalendar
      className="ui--date-input__calendar"
      value={(value as { value?: Date } | null)?.value ?? null}
      onChange={(date) => {
        onChange?.(
          { value: date as Date, label: "" },
          { action: "select-option", option: undefined },
        );
        onMenuClose();
      }}
    />
  );
};

/**
 * A date with a calendar dropdown. Phones get the device's own date picker
 * instead, since a dropdown gets cut off on a small screen.
 */
function DateInput({
  value,
  onChange,
  onBlur,
  name,
  disabled,
  className,
  clearable = true,
  "aria-invalid": invalid,
  ...aria
}: DateInputProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <input
        {...aria}
        type="date"
        className={cn("ui--input", className)}
        value={value ? format(value, "yyyy-MM-dd") : ""}
        onChange={(e) =>
          onChange?.(
            e.target.value
              ? parse(e.target.value, "yyyy-MM-dd", new Date())
              : undefined,
          )
        }
        onBlur={onBlur}
        name={name}
        disabled={disabled}
        aria-invalid={invalid}
      />
    );
  }

  return (
    <Select
      {...aria}
      className={className}
      name={name}
      value={value ? { value, label: formatHumanReadableDate(value) } : null}
      onChange={(option) => onChange?.(option?.value ?? undefined)}
      onBlur={onBlur}
      isDisabled={disabled}
      isClearable={clearable}
      isSearchable={false}
      aria-invalid={invalid}
      components={{ MenuList: CalendarMenu }}
      styles={{
        container: (provided) => ({ ...provided, width: "100%" }),
        menu: (provided) => ({ ...provided, width: 350, right: 0 }),
      }}
    />
  );
}

function DateInputControl({
  control,
  name,
  label,
  description,
  ...props
}: Omit<DateInputProps, "value" | "onChange" | "name"> & {
  name: string;
  label: string;
  description?: string;
  control: Control<any, any, any>;
  onChange?: (value: Date | undefined) => void;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <DateInput
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

export { DateInput, DateInputControl };
