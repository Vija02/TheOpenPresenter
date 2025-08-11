import { TagFragment } from "@repo/graphql";

export default function useCalculatedColor(
  backgroundColor: TagFragment["backgroundColor"],
  foregroundColor: TagFragment["foregroundColor"],
) {
  const calculatedBackgroundColor =
    !backgroundColor || backgroundColor === "" ? "lightgray" : backgroundColor;
  const calculatedForegroundColor =
    !foregroundColor || foregroundColor === "" ? "black" : foregroundColor;

  const finalBgColor = backgroundColor?.includes("#")
    ? backgroundColor
    : calculatedBackgroundColor;
  const finalFgColor = foregroundColor?.includes("#")
    ? foregroundColor
    : calculatedForegroundColor;

  return {
    backgroundColor: finalBgColor,
    foregroundColor: finalFgColor,
  };
}
