import { cn } from "@/lib/utils";
import { PipetteIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { HexAlphaColorPicker, HexColorPicker } from "react-colorful";
import { Control } from "react-hook-form";

import { Button } from "./button";
import "./colorPicker.css";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Select } from "./select";

// Color conversion utilities
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

const rgbToHex = (r: number, g: number, b: number) => {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
      .toUpperCase()
  );
};

const hexToRgba = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(
    hex,
  );
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: result[4] ? parseInt(result[4], 16) / 255 : 1,
      }
    : { r: 0, g: 0, b: 0, a: 1 };
};

const rgbaToHex = (r: number, g: number, b: number, a: number) => {
  return (
    "#" +
    [r, g, b, Math.round(a * 255)]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
      .toUpperCase()
  );
};

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  alpha?: boolean;
}

interface ColorValues {
  hex: string;
  rgb: { r: number; g: number; b: number };
  rgba?: { r: number; g: number; b: number; a: number };
}

function ColorPicker({
  value,
  onChange,
  onBlur,
  className,
  alpha = false,
}: ColorPickerProps) {
  const [colorFormat, setColorFormat] = useState(alpha ? "HEXA" : "HEX");
  const [colorValues, setColorValues] = useState<ColorValues>(() => {
    if (alpha) {
      const rgba = hexToRgba(value);
      return {
        hex: value.length === 9 ? value.slice(0, 7) : value,
        rgb: { r: rgba.r, g: rgba.g, b: rgba.b },
        rgba,
      };
    } else {
      const rgb = hexToRgb(value);
      return {
        hex: value,
        rgb,
      };
    }
  });
  const [hexInputValue, setHexInputValue] = useState(value);
  const [hexInputError, setHexInputError] = useState<string | null>(null);

  const maxLength = alpha ? 9 : 7;

  // Update all color formats when color changes
  const updateColorValues = useCallback(
    (newColor: string) => {
      if (alpha) {
        const rgba = hexToRgba(newColor);
        setColorValues({
          hex: newColor.length === 9 ? newColor.slice(0, 7) : newColor,
          rgb: { r: rgba.r, g: rgba.g, b: rgba.b },
          rgba,
        });
        setHexInputValue(newColor.toUpperCase());
      } else {
        const rgb = hexToRgb(newColor);
        setColorValues({
          hex: newColor.toUpperCase(),
          rgb,
        });
        setHexInputValue(newColor.toUpperCase());
      }
    },
    [alpha],
  );

  // Handle color picker change
  const handleColorChange = useCallback(
    (newColor: string) => {
      updateColorValues(newColor);
      onChange(newColor.toUpperCase());
    },
    [onChange, updateColorValues],
  );

  // Handle HEX input change
  const handleHexChange = useCallback(
    (inputValue: string) => {
      let formattedValue = inputValue.toUpperCase();
      if (!formattedValue.startsWith("#")) {
        formattedValue = "#" + formattedValue;
      }

      if (
        formattedValue.length <= maxLength &&
        /^#[0-9A-Fa-f]*$/.test(formattedValue)
      ) {
        setHexInputValue(formattedValue);
        updateColorValues(formattedValue);
        onChange(formattedValue);

        if (formattedValue.length === maxLength) {
          setHexInputError(null);
        } else {
          setHexInputError("Enter a valid color");
        }
      }
    },
    [maxLength, onChange, updateColorValues],
  );

  // Handle RGB input change
  const handleRgbChange = useCallback(
    (component: "r" | "g" | "b", inputValue: string) => {
      const numValue = Number.parseInt(inputValue) || 0;
      const clampedValue = Math.max(0, Math.min(255, numValue));
      const newRgb = { ...colorValues.rgb, [component]: clampedValue };
      const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);

      setColorValues({ ...colorValues, hex, rgb: newRgb });
      setHexInputValue(hex);
      onChange(hex);
    },
    [colorValues, onChange],
  );

  // Handle RGBA input change
  const handleRgbaChange = useCallback(
    (component: "r" | "g" | "b" | "a", inputValue: string) => {
      if (!alpha || !colorValues.rgba) return;

      const numValue = Number.parseFloat(inputValue) || 0;
      let clampedValue;

      if (component === "a") {
        clampedValue = Math.max(0, Math.min(1, numValue));
      } else {
        clampedValue = Math.max(0, Math.min(255, Math.floor(numValue)));
      }

      const newRgba = { ...colorValues.rgba, [component]: clampedValue };
      const hex = rgbaToHex(newRgba.r, newRgba.g, newRgba.b, newRgba.a);

      setColorValues({
        ...colorValues,
        hex: hex.slice(0, 7),
        rgb: { r: newRgba.r, g: newRgba.g, b: newRgba.b },
        rgba: newRgba,
      });
      setHexInputValue(hex);
      onChange(hex);
    },
    [alpha, colorValues, onChange],
  );

  // Handle popover close
  const handlePopoverChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setColorFormat(alpha ? "HEXA" : "HEX");
        onBlur?.();
      }
    },
    [alpha, onBlur],
  );

  // Check if EyeDropper API is available
  const isEyeDropperAvailable = useCallback(() => {
    return typeof window !== "undefined" && "EyeDropper" in window;
  }, []);

  // Handle eyedropper click
  const handleEyeDropper = useCallback(async () => {
    if (!isEyeDropperAvailable()) {
      return;
    }
    try {
      // @ts-expect-error - TypeScript doesn't have types for EyeDropper yet
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      let pickedColor = result.sRGBHex.toUpperCase();
      if (alpha && pickedColor.length === 7) {
        pickedColor = pickedColor + "FF";
      }
      updateColorValues(pickedColor);
      onChange(pickedColor);
    } catch {
      // User canceled the eyedropper
    }
  }, [isEyeDropperAvailable, alpha, updateColorValues, onChange]);

  // Initialize color values on mount and when value changes from outside
  useEffect(() => {
    updateColorValues(value);
    setHexInputValue(value?.toUpperCase() ?? (alpha ? "#000000FF" : "#000000"));
  }, [value, alpha, updateColorValues]);

  // Get current hex value for display
  const getCurrentHexValue = useCallback(() => {
    if (colorFormat === "HEX" || colorFormat === "HEXA") {
      return hexInputValue;
    }
    if (alpha && colorValues.rgba) {
      return rgbaToHex(
        colorValues.rgba.r,
        colorValues.rgba.g,
        colorValues.rgba.b,
        colorValues.rgba.a,
      );
    }
    return colorValues.hex;
  }, [colorFormat, hexInputValue, alpha, colorValues]);

  return (
    <div className={cn("ui--color-picker", className)}>
      <Popover onOpenChange={handlePopoverChange}>
        <PopoverTrigger asChild>
          <Button
            className="ui--color-picker__swatch"
            size="icon"
            style={{ backgroundColor: hexInputValue }}
          >
            {alpha && colorValues.rgba && colorValues.rgba.a < 1 && (
              <div className="ui--color-picker__swatch-checkerboard" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="ui--color-picker__popover"
          align="start"
          hideCloseButton
          hideArrow
        >
          <div className="ui--color-picker__content">
            <div className="ui--color-picker__picker-wrapper">
              <Button
                variant="ghost"
                size="mini"
                className="ui--color-picker__eyedropper"
                onClick={handleEyeDropper}
                disabled={!isEyeDropperAvailable()}
              >
                <PipetteIcon className="h-3 w-3" />
              </Button>
              {alpha ? (
                <HexAlphaColorPicker
                  className="ui--color-picker__hex-picker"
                  color={value}
                  onChange={handleColorChange}
                />
              ) : (
                <HexColorPicker
                  className="ui--color-picker__hex-picker"
                  color={value}
                  onChange={handleColorChange}
                />
              )}
            </div>
            <div className="ui--color-picker__format-row">
              <Select
                className="ui--color-picker__format-select"
                value={
                  alpha
                    ? [
                        { label: "HEXA", value: "HEXA" },
                        { label: "RGBA", value: "RGBA" },
                      ].find((o) => o.value === colorFormat)
                    : [
                        { label: "HEX", value: "HEX" },
                        { label: "RGB", value: "RGB" },
                      ].find((o) => o.value === colorFormat)
                }
                onChange={(option) => {
                  if (option) {
                    setColorFormat((option as { value: string }).value);
                  }
                }}
                options={
                  alpha
                    ? [
                        { label: "HEXA", value: "HEXA" },
                        { label: "RGBA", value: "RGBA" },
                      ]
                    : [
                        { label: "HEX", value: "HEX" },
                        { label: "RGB", value: "RGB" },
                      ]
                }
                isSearchable={false}
                menuPlacement="auto"
              />
              {colorFormat === "HEX" || colorFormat === "HEXA" ? (
                <Input
                  className="ui--color-picker__format-input"
                  value={getCurrentHexValue()}
                  onChange={(e) => handleHexChange(e.target.value)}
                  placeholder={alpha ? "#FF0000FF" : "#FF0000"}
                  maxLength={maxLength}
                />
              ) : colorFormat === "RGB" ? (
                <div className="ui--color-picker__rgb-inputs">
                  <Input
                    className="ui--color-picker__rgb-input ui--color-picker__rgb-input--first"
                    value={colorValues.rgb.r}
                    onChange={(e) => handleRgbChange("r", e.target.value)}
                    placeholder="255"
                    maxLength={3}
                  />
                  <Input
                    className="ui--color-picker__rgb-input ui--color-picker__rgb-input--middle"
                    value={colorValues.rgb.g}
                    onChange={(e) => handleRgbChange("g", e.target.value)}
                    placeholder="255"
                    maxLength={3}
                  />
                  <Input
                    className="ui--color-picker__rgb-input ui--color-picker__rgb-input--last"
                    value={colorValues.rgb.b}
                    onChange={(e) => handleRgbChange("b", e.target.value)}
                    placeholder="255"
                    maxLength={3}
                  />
                </div>
              ) : colorFormat === "RGBA" && alpha && colorValues.rgba ? (
                <div className="ui--color-picker__rgb-inputs">
                  <Input
                    className="ui--color-picker__rgba-input ui--color-picker__rgb-input--first"
                    value={colorValues.rgba.r}
                    onChange={(e) => handleRgbaChange("r", e.target.value)}
                    placeholder="255"
                    maxLength={3}
                  />
                  <Input
                    className="ui--color-picker__rgba-input ui--color-picker__rgb-input--middle"
                    value={colorValues.rgba.g}
                    onChange={(e) => handleRgbaChange("g", e.target.value)}
                    placeholder="255"
                    maxLength={3}
                  />
                  <Input
                    className="ui--color-picker__rgba-input ui--color-picker__rgb-input--middle"
                    value={colorValues.rgba.b}
                    onChange={(e) => handleRgbaChange("b", e.target.value)}
                    placeholder="255"
                    maxLength={3}
                  />
                  <Input
                    className="ui--color-picker__rgba-input ui--color-picker__rgb-input--last"
                    value={colorValues.rgba.a.toFixed(2)}
                    onChange={(e) => handleRgbaChange("a", e.target.value)}
                    placeholder="1.00"
                    maxLength={4}
                  />
                </div>
              ) : null}
            </div>
            {hexInputError && (
              <p className="ui--color-picker__error">{hexInputError}</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <div className="ui--color-picker__input-wrapper">
        <Input
          className="ui--color-picker__external-input"
          value={getCurrentHexValue()}
          onChange={(e) => handleHexChange(e.target.value)}
          onBlur={onBlur}
          placeholder={alpha ? "#000000FF" : "#000000"}
          maxLength={maxLength}
        />
      </div>
    </div>
  );
}

function ColorPickerControl({
  control,
  name,
  label,
  description,
  className,
  alpha,
}: {
  name: string;
  label: string;
  description?: string;
  control: Control<any, any, any>;
  className?: string;
  alpha?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <ColorPicker
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              alpha={alpha}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { ColorPicker, ColorPickerControl };
