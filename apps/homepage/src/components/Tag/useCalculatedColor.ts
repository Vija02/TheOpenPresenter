import { useToken } from "@chakra-ui/react";
import { TagFragment } from "@repo/graphql";

export default function useCalculatedColor(
  backgroundColor: TagFragment["backgroundColor"],
  foregroundColor: TagFragment["foregroundColor"],
) {
  const calculatedBackgroundColor = useToken(
    "colors",
    !backgroundColor || backgroundColor === "" ? "gray.200" : backgroundColor,
  );
  const calculatedForegroundColor = useToken(
    "colors",
    !foregroundColor || foregroundColor === "" ? "black" : foregroundColor,
  );

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
