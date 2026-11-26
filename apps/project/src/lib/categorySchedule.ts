import { CategoryFragment } from "@repo/graphql";
import {
  categoryEndsAt,
  describeCadence,
  fromDateValue,
  nextOccurrence,
  parseCadence,
} from "@repo/lib";

import { formatTimeLabel } from "./projectDate";

type ScheduleFields = Pick<
  CategoryFragment,
  "recurrence" | "recurrenceAnchor" | "startTime" | "durationMinutes"
>;

/** e.g. "Every Sunday at 10:30 AM" */
export const categoryScheduleLabel = (category: ScheduleFields) => {
  const cadence = parseCadence(category.recurrence);
  const time = category.startTime ? formatTimeLabel(category.startTime) : null;
  if (cadence) return describeCadence(cadence) + (time ? ` at ${time}` : "");
  if (category.recurrence) return "Custom schedule";
  return time ? `At ${time}` : null;
};

/** Name for "no category"; "Other" unless a real category already uses it */
export const noCategoryLabel = (categories: { name: string }[]) =>
  categories.some((c) => c.name.toLowerCase() === "other")
    ? "Uncategorized"
    : "Other";

export const categoryNextDate = (
  category: ScheduleFields,
  from?: Date,
): Date | null => {
  const cadence = parseCadence(category.recurrence);
  if (!cadence) return null;
  return nextOccurrence(cadence, {
    from,
    anchor: category.recurrenceAnchor
      ? fromDateValue(category.recurrenceAnchor)
      : null,
    endsAt: categoryEndsAt(category.startTime, category.durationMinutes),
  });
};
