import { SlideStyle } from "./types";

export const getSlideStyle = (
  slideStyle?: SlideStyle,
): Required<SlideStyle> => {
  return {
    fontWeight: slideStyle?.fontWeight ?? 600,
    isDarkMode: slideStyle?.isDarkMode ?? true,
    padding: slideStyle?.padding ?? 20,
  };
};
