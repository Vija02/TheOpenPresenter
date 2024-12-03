import { SlideStyle } from "./types";

export const getSlideStyle = (
  slideStyle?: SlideStyle,
): Required<SlideStyle> => {
  return {
    autoSize: slideStyle?.autoSize ?? true,
    fontSize: slideStyle?.fontSize ?? 14,
    fontWeight: slideStyle?.fontWeight ?? "600",
    fontStyle: slideStyle?.fontStyle ?? "normal",
    fontFamily:
      slideStyle?.fontFamily ??
      `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,
    lineHeight: slideStyle?.lineHeight ?? 1,
    isDarkMode: slideStyle?.isDarkMode ?? true,
    padding: slideStyle?.padding ?? 4,
    paddingIsLinked: slideStyle?.paddingIsLinked ?? true,
    leftPadding: slideStyle?.leftPadding ?? 4,
    topPadding: slideStyle?.topPadding ?? 4,
    rightPadding: slideStyle?.rightPadding ?? 4,
    bottomPadding: slideStyle?.bottomPadding ?? 4,
    debugPadding: slideStyle?.debugPadding ?? false,
  };
};
