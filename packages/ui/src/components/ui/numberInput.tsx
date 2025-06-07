import { cn } from "@/lib/utils";
import {
  type ChangeEvent,
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
  type WheelEvent,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Control, FieldPath, FieldValues } from "react-hook-form";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import "./numberInput.css";

export interface NumberInputProps
  extends Omit<ComponentProps<"input">, "onChange" | "value"> {
  value?: number;
  onChange?: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  showStepper?: boolean;
  allowMouseWheel?: boolean;
  clampValueOnBlur?: boolean;
  keepWithinRange?: boolean;
  formatValue?: (value: number) => string;
  parseValue?: (value: string) => number;
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      value,
      onChange,
      min,
      max,
      step = 1,
      precision,
      showStepper = true,
      allowMouseWheel = false,
      clampValueOnBlur = true,
      keepWithinRange = true,
      formatValue,
      parseValue,
      onBlur,
      onKeyDown,
      onWheel,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [inputValue, setInputValue] = useState<string>(() => {
      if (value === undefined || value === null) return "";
      return formatValue ? formatValue(value) : String(value);
    });

    const [isFocused, setIsFocused] = useState(false);

    // Update input value when prop value changes
    useEffect(() => {
      if (!isFocused) {
        if (value === undefined || value === null) {
          setInputValue("");
        } else {
          setInputValue(formatValue ? formatValue(value) : String(value));
        }
      }
    }, [value, formatValue, isFocused]);

    const clampValue = useCallback(
      (val: number): number => {
        if (!keepWithinRange) return val;
        let clampedValue = val;
        if (min !== undefined && clampedValue < min) clampedValue = min;
        if (max !== undefined && clampedValue > max) clampedValue = max;
        return clampedValue;
      },
      [min, max, keepWithinRange],
    );

    const roundToPrecision = useCallback(
      (val: number): number => {
        if (precision === undefined) return val;
        return (
          Math.round(val * Math.pow(10, precision)) / Math.pow(10, precision)
        );
      },
      [precision],
    );

    const parseInputValue = useCallback(
      (inputVal: string): number | undefined => {
        if (inputVal === "" || inputVal === "-") return undefined;

        let parsed: number;
        if (parseValue) {
          parsed = parseValue(inputVal);
        } else {
          parsed = parseFloat(inputVal);
        }

        if (isNaN(parsed)) return undefined;

        return roundToPrecision(clampValue(parsed));
      },
      [parseValue, clampValue, roundToPrecision],
    );

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
      const newInputValue = e.target.value;
      setInputValue(newInputValue);

      const parsedValue = parseInputValue(newInputValue);
      onChange?.(parsedValue);
    };

    const handleBlur = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);

        if (clampValueOnBlur && value !== undefined) {
          const clampedValue = clampValue(value);
          if (clampedValue !== value) {
            onChange?.(clampedValue);
          }
        }

        onBlur?.(e);
      },
      [clampValueOnBlur, value, clampValue, onChange, onBlur],
    );

    const handleFocus = useCallback(() => {
      setIsFocused(true);
    }, []);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const direction = e.key === "ArrowUp" ? 1 : -1;
          const currentValue = value ?? 0;
          const newValue = roundToPrecision(
            clampValue(currentValue + direction * step),
          );
          onChange?.(newValue);
        }
        onKeyDown?.(e);
      },
      [value, step, roundToPrecision, clampValue, onChange, onKeyDown],
    );

    const handleWheel = useCallback(
      (e: WheelEvent<HTMLInputElement>) => {
        if (allowMouseWheel && !disabled && isFocused) {
          e.preventDefault();
          const direction = e.deltaY < 0 ? 1 : -1;
          const currentValue = value ?? 0;
          const newValue = roundToPrecision(
            clampValue(currentValue + direction * step),
          );
          onChange?.(newValue);
        }
        onWheel?.(e);
      },
      [
        allowMouseWheel,
        disabled,
        isFocused,
        value,
        step,
        roundToPrecision,
        clampValue,
        onChange,
        onWheel,
      ],
    );

    const handleStepperClick = useCallback(
      (direction: 1 | -1) => {
        if (disabled) return;
        const currentValue = value ?? 0;
        const newValue = roundToPrecision(
          clampValue(currentValue + direction * step),
        );
        onChange?.(newValue);
      },
      [disabled, value, step, roundToPrecision, clampValue, onChange],
    );

    const canIncrement = useMemo(
      () => !disabled && (max === undefined || (value ?? 0) < max),
      [disabled, max, value],
    );
    const canDecrement = useMemo(
      () => !disabled && (min === undefined || (value ?? 0) > min),
      [disabled, min, value],
    );

    return (
      <div
        className={cn("ui--number-input", className)}
        aria-invalid={props["aria-invalid"]}
      >
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onWheel={handleWheel}
          disabled={disabled}
          className="ui--number-input-field"
          data-slot="number-input-field"
          {...props}
        />
        {showStepper && (
          <div
            className="ui--number-input-stepper"
            data-slot="number-input-stepper"
          >
            <button
              type="button"
              className="ui--number-input-stepper-button"
              onClick={() => handleStepperClick(1)}
              disabled={!canIncrement}
              tabIndex={-1}
              aria-label="Increment value"
              data-slot="number-input-increment"
            >
              <FiChevronUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="ui--number-input-stepper-button"
              onClick={() => handleStepperClick(-1)}
              disabled={!canDecrement}
              tabIndex={-1}
              aria-label="Decrement value"
              data-slot="number-input-decrement"
            >
              <FiChevronDown className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  },
);

NumberInput.displayName = "NumberInput";

export interface NumberInputControlProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends Omit<NumberInputProps, "value" | "onChange"> {
  name: TName;
  label: string;
  description?: string;
  control: Control<TFieldValues>;
  unit?: string;
  unitClassName?: string;
}

function NumberInputControl<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  unit,
  unitClassName,
  ...props
}: NumberInputControlProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const component = (
          <NumberInput
            {...field}
            {...props}
            value={field.value}
            onChange={(value) => field.onChange(value)}
          />
        );

        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              {unit ? (
                <div className="ui--number-input-wrapper">
                  {component}
                  <span className={cn("ui--number-input-unit", unitClassName)}>
                    {unit}
                  </span>
                </div>
              ) : (
                component
              )}
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

export { NumberInput, NumberInputControl };
