import { SlideStyle } from "./types";

const defaultSlideStyle: Required<SlideStyle> = {
  autoSize: true,
  fontSize: 14,
  fontWeight: "600",
  fontStyle: "normal",
  fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,
  lineHeight: 1,
  isDarkMode: true,
  verticalAlign: "center",
  padding: 4,
  paddingIsLinked: true,
  leftPadding: 4,
  topPadding: 4,
  rightPadding: 4,
  bottomPadding: 4,
  debugPadding: false,
};

export const getSlideStyle = (
  slideStyle?: SlideStyle,
): Required<SlideStyle> => {
  return {
    autoSize: slideStyle?.autoSize ?? defaultSlideStyle.autoSize,
    fontSize: slideStyle?.fontSize ?? defaultSlideStyle.fontSize,
    fontWeight: slideStyle?.fontWeight ?? defaultSlideStyle.fontWeight,
    fontStyle: slideStyle?.fontStyle ?? defaultSlideStyle.fontStyle,
    fontFamily: slideStyle?.fontFamily ?? defaultSlideStyle.fontFamily,
    lineHeight: slideStyle?.lineHeight ?? defaultSlideStyle.lineHeight,
    isDarkMode: slideStyle?.isDarkMode ?? defaultSlideStyle.isDarkMode,
    verticalAlign: slideStyle?.verticalAlign ?? defaultSlideStyle.verticalAlign,
    padding: slideStyle?.padding ?? defaultSlideStyle.padding,
    paddingIsLinked:
      slideStyle?.paddingIsLinked ?? defaultSlideStyle.paddingIsLinked,
    leftPadding: slideStyle?.leftPadding ?? defaultSlideStyle.leftPadding,
    topPadding: slideStyle?.topPadding ?? defaultSlideStyle.topPadding,
    rightPadding: slideStyle?.rightPadding ?? defaultSlideStyle.rightPadding,
    bottomPadding: slideStyle?.bottomPadding ?? defaultSlideStyle.bottomPadding,
    debugPadding: slideStyle?.debugPadding ?? defaultSlideStyle.debugPadding,
  };
};

/**
 * Merges global style with per-song style override.
 * The override values take precedence over global values.
 * Only non-undefined values in the override are applied.
 */
export const getMergedSlideStyle = (
  globalStyle?: SlideStyle,
  styleOverride?: SlideStyle | null,
): Required<SlideStyle> => {
  // First apply global style on top of defaults
  const baseStyle = getSlideStyle(globalStyle);

  // If no override, return base style
  if (!styleOverride) {
    return baseStyle;
  }

  // Apply overrides only for defined values
  return {
    autoSize: styleOverride.autoSize ?? baseStyle.autoSize,
    fontSize: styleOverride.fontSize ?? baseStyle.fontSize,
    fontWeight: styleOverride.fontWeight ?? baseStyle.fontWeight,
    fontStyle: styleOverride.fontStyle ?? baseStyle.fontStyle,
    fontFamily: styleOverride.fontFamily ?? baseStyle.fontFamily,
    lineHeight: styleOverride.lineHeight ?? baseStyle.lineHeight,
    isDarkMode: styleOverride.isDarkMode ?? baseStyle.isDarkMode,
    verticalAlign: styleOverride.verticalAlign ?? baseStyle.verticalAlign,
    padding: styleOverride.padding ?? baseStyle.padding,
    paddingIsLinked: styleOverride.paddingIsLinked ?? baseStyle.paddingIsLinked,
    leftPadding: styleOverride.leftPadding ?? baseStyle.leftPadding,
    topPadding: styleOverride.topPadding ?? baseStyle.topPadding,
    rightPadding: styleOverride.rightPadding ?? baseStyle.rightPadding,
    bottomPadding: styleOverride.bottomPadding ?? baseStyle.bottomPadding,
    debugPadding: styleOverride.debugPadding ?? baseStyle.debugPadding,
  };
};

export { defaultSlideStyle };
