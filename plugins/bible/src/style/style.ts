import { BibleSlideStyle } from "../types";

export const defaultBibleStyle: Required<BibleSlideStyle> = {
  fontSize: 3,
  fontWeight: 600,
  fontFamily: "Arial, sans-serif",
  textColor: "#ffffff",
  backgroundColor: "#000000",
  textAlign: "center",
  showReference: true,
  showVerseNumbers: false,
  textShadow: true,
};

export const getBibleStyle = (
  style?: BibleSlideStyle | null,
): Required<BibleSlideStyle> => ({
  ...defaultBibleStyle,
  ...(style ?? {}),
});
