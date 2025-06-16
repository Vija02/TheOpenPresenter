import { cx } from "class-variance-authority";
import { format, formatDistanceToNowStrict } from "date-fns";

export type DateDisplayPropTypes = {
  date: Date;
  formatToken?: string;
  className?: string;
};
export function DateDisplay({
  date,
  className,
  formatToken,
}: DateDisplayPropTypes) {
  const humanReadable = formatHumanReadableDate(date, formatToken);

  return (
    <p
      className={cx("inline nowrap", className)}
      title={date.toISOString()}
      suppressHydrationWarning
    >
      {humanReadable}
    </p>
  );
}

export function formatHumanReadableDate(date: Date, formatToken?: string) {
  return format(date, formatToken ?? "yyyy-MM-dd");
}

// ========================
// Relative to now display
// ========================

export type DateDisplayRelativePropTypes = {
  date: Date;
  className?: string;
  isFuture?: boolean;
};
export function DateDisplayRelative({
  date,
  className,
  isFuture = false,
}: DateDisplayRelativePropTypes) {
  const humanReadable = formatHumanReadableDateRelative(date);

  return (
    <span
      className={cx("text-inherit inline nowrap", className)}
      title={date.toISOString()}
      suppressHydrationWarning
    >
      {!!isFuture && "in "}
      {humanReadable}
      {!isFuture && " ago"}
    </span>
  );
}

export function formatHumanReadableDateRelative(date: Date) {
  return formatDistanceToNowStrict(date);
}
