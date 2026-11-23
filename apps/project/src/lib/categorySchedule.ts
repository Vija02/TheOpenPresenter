import { CategoryFragment } from "@repo/graphql";
import {
  categoryEndsAt,
  describeCadence,
  formatCategoryTime,
  fromDateValue,
  nextOccurrence,
  parseCadence,
} from "@repo/lib";

type ScheduleFields = Pick<
  CategoryFragment,
  "recurrence" | "recurrenceAnchor" | "startTime" | "durationMinutes"
>;

/** e.g. "Every Sunday at 10:30" */
export const categoryScheduleLabel = (category: ScheduleFields) => {
  const cadence = parseCadence(category.recurrence);
  const time = category.startTime
    ? formatCategoryTime(category.startTime)
    : null;
  if (cadence) return describeCadence(cadence) + (time ? ` at ${time}` : "");
  if (category.recurrence) return "Custom schedule";
  return time ? `At ${time}` : null;
};

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
