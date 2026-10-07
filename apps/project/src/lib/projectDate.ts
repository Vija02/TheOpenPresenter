// A project's target date is a calendar day, but it's stored as a timestamptz.
// We store the picked day as midnight UTC so it reads back as the same day
// whatever the viewer's time zone.

/** Picked day (local midnight) -> value to send as the project's targetDate */
export const toProjectDateValue = (date: Date): string =>
  new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  ).toISOString();

/** Stored targetDate -> local-midnight Date for that calendar day */
export const fromProjectDateValue = (value: string): Date => {
  const stored = new Date(value);
  const isUtcMidnight =
    stored.getUTCHours() === 0 &&
    stored.getUTCMinutes() === 0 &&
    stored.getUTCSeconds() === 0 &&
    stored.getUTCMilliseconds() === 0;

  // Older rows may hold midnight in the server's (or desktop's) local time
  // zone instead, which the viewer's local date gets closest to
  if (!isUtcMidnight) {
    return new Date(stored.getFullYear(), stored.getMonth(), stored.getDate());
  }
  return new Date(
    stored.getUTCFullYear(),
    stored.getUTCMonth(),
    stored.getUTCDate(),
  );
};
