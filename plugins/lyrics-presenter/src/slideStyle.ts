import { SlideStyle } from "./types";

export const getSlideStyle = (
  slideStyle?: SlideStyle,
): Required<SlideStyle> => {
  return {
    autoSize: slideStyle?.autoSize ?? true,
    fontSize: slideStyle?.fontSize ?? 12,
    fontWeight: slideStyle?.fontWeight ?? "600",
    fontStyle: slideStyle?.fontStyle ?? "normal",
    fontFamily:
      slideStyle?.fontFamily ??
      `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,
    lineHeight: slideStyle?.lineHeight ?? 1,
    isDarkMode: slideStyle?.isDarkMode ?? true,
    padding: slideStyle?.padding ?? 4,
    debugPadding: slideStyle?.debugPadding ?? false,
  };
};
