import { Text, TextProps } from "@chakra-ui/react";
import { formatDistanceToNowStrict, lightFormat } from "date-fns";

export type DateDisplayPropTypes = {
  date: Date;
  textProps?: TextProps;
};
export function DateDisplay({ date, textProps }: DateDisplayPropTypes) {
  const humanReadable = formatHumanReadableDate(date);

  return (
    <Text
      display="inline"
      whiteSpace="nowrap"
      title={date.toISOString()}
      suppressHydrationWarning
      {...textProps}
    >
      {humanReadable}
    </Text>
  );
}

export function formatHumanReadableDate(date: Date) {
  return lightFormat(date, "yyyy-MM-dd");
}

// ========================
// Relative to now display
// ========================

export type DateDisplayRelativePropTypes = {
  date: Date;
  textProps?: TextProps;
  isFuture?: boolean;
};
export function DateDisplayRelative({
  date,
  textProps,
  isFuture = false,
}: DateDisplayRelativePropTypes) {
  const humanReadable = formatHumanReadableDateRelative(date);

  return (
    <Text
      color="inherit"
      as="span"
      display="inline"
      whiteSpace="nowrap"
      title={date.toISOString()}
      suppressHydrationWarning
      {...textProps}
    >
      {!!isFuture && "in "}
      {humanReadable}
      {!isFuture && " ago"}
    </Text>
  );
}

export function formatHumanReadableDateRelative(date: Date) {
  return formatDistanceToNowStrict(date);
}
