import { describe, expect, it } from "vitest";

import {
  categoryEndsAt,
  describeCadence,
  formatCadence,
  nextOccurrence,
  nextOccurrences,
  nextPeriodStarts,
  parseCadence,
  toDateValue,
} from "../categorySchedule";

const d = (s: string) => {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y!, m! - 1, day!);
};
const days = (dates: Date[]) => dates.map(toDateValue);

describe("parseCadence / formatCadence", () => {
  it.each([
    ["FREQ=WEEKLY;BYDAY=SU", { kind: "weekly", interval: 1, weekdays: [0] }],
    [
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=WE",
      { kind: "weekly", interval: 2, weekdays: [3] },
    ],
    [
      "FREQ=WEEKLY;BYDAY=SA,SU",
      { kind: "weekly", interval: 1, weekdays: [6, 0] },
    ],
    [
      "FREQ=MONTHLY;BYDAY=-1SU",
      { kind: "monthly", interval: 1, week: -1, weekday: 0 },
    ],
    [
      "FREQ=MONTHLY;INTERVAL=3;BYDAY=1SA",
      { kind: "monthly", interval: 3, week: 1, weekday: 6 },
    ],
  ])("round-trips %s", (rrule, cadence) => {
    expect(parseCadence(rrule)).toEqual(cadence);
    expect(formatCadence(cadence as any)).toBe(rrule);
  });

  it("normalises day order to Monday first", () => {
    expect(formatCadence(parseCadence("FREQ=WEEKLY;BYDAY=SU,MO")!)).toBe(
      "FREQ=WEEKLY;BYDAY=MO,SU",
    );
  });

  it.each([
    null,
    "",
    "FREQ=DAILY",
    "FREQ=WEEKLY;BYDAY=SU,SU",
    "FREQ=MONTHLY;BYDAY=1SU,2SU",
    "FREQ=WEEKLY;BYDAY=1SU",
    "FREQ=MONTHLY;BYDAY=SU",
    "FREQ=WEEKLY;BYDAY=SU;COUNT=3",
    "FREQ=WEEKLY;INTERVAL=0;BYDAY=SU",
  ])("rejects %s", (rrule) => {
    expect(parseCadence(rrule)).toBeNull();
  });
});

describe("describeCadence", () => {
  it("reads naturally", () => {
    expect(describeCadence(parseCadence("FREQ=WEEKLY;BYDAY=SU")!)).toBe(
      "Every Sunday",
    );
    expect(
      describeCadence(parseCadence("FREQ=WEEKLY;INTERVAL=2;BYDAY=FR")!),
    ).toBe("Every 2 weeks on Friday");
    expect(describeCadence(parseCadence("FREQ=MONTHLY;BYDAY=-1SU")!)).toBe(
      "Last Sunday of the month",
    );
    expect(describeCadence(parseCadence("FREQ=WEEKLY;BYDAY=MO,WE,FR")!)).toBe(
      "Every Monday, Wednesday and Friday",
    );
    expect(
      describeCadence(parseCadence("FREQ=MONTHLY;INTERVAL=2;BYDAY=2SU")!),
    ).toBe("Second Sunday of every 2 months");
  });
});

describe("nextOccurrences", () => {
  // 2026-11-13 is a Friday
  const from = d("2026-11-13");

  it("finds the coming weekday, including today", () => {
    const sunday = parseCadence("FREQ=WEEKLY;BYDAY=SU")!;
    expect(days(nextOccurrences(sunday, { from, count: 3 }))).toEqual([
      "2026-11-15",
      "2026-11-22",
      "2026-11-29",
    ]);
    const friday = parseCadence("FREQ=WEEKLY;BYDAY=FR")!;
    expect(toDateValue(nextOccurrence(friday, { from })!)).toBe("2026-11-13");
  });

  it("uses the anchor to pick the right weeks", () => {
    const fortnightly = parseCadence("FREQ=WEEKLY;INTERVAL=2;BYDAY=SU")!;
    expect(
      days(
        nextOccurrences(fortnightly, {
          from,
          anchor: d("2026-11-22"),
          count: 2,
        }),
      ),
    ).toEqual(["2026-11-22", "2026-12-06"]);
    // Anchor in the past, and not on the weekday itself
    expect(
      toDateValue(
        nextOccurrence(fortnightly, { from, anchor: d("2026-10-28") })!,
      ),
    ).toBe("2026-11-15");
  });

  it("handles nth and last weekday of the month", () => {
    const last = parseCadence("FREQ=MONTHLY;BYDAY=-1SU")!;
    expect(days(nextOccurrences(last, { from, count: 3 }))).toEqual([
      "2026-11-29",
      "2026-12-27",
      "2027-01-31",
    ]);
    const first = parseCadence("FREQ=MONTHLY;BYDAY=1SU")!;
    expect(days(nextOccurrences(first, { from, count: 2 }))).toEqual([
      "2026-12-06",
      "2027-01-03",
    ]);
  });

  it("handles several days a week, every other week", () => {
    const weekend = parseCadence("FREQ=WEEKLY;INTERVAL=2;BYDAY=SA,SU")!;
    expect(
      days(
        nextOccurrences(weekend, { from, anchor: d("2026-11-14"), count: 4 }),
      ),
    ).toEqual(["2026-11-14", "2026-11-15", "2026-11-28", "2026-11-29"]);
    // Anchored in the off week
    expect(
      days(
        nextOccurrences(weekend, { from, anchor: d("2026-11-21"), count: 2 }),
      ),
    ).toEqual(["2026-11-21", "2026-11-22"]);
  });

  it("handles every N months", () => {
    const quarterly = parseCadence("FREQ=MONTHLY;INTERVAL=3;BYDAY=1SU")!;
    expect(
      days(
        nextOccurrences(quarterly, { from, anchor: d("2026-10-04"), count: 2 }),
      ),
    ).toEqual(["2027-01-03", "2027-04-04"]);
  });
});

describe("today, once it's over", () => {
  const sunday = parseCadence("FREQ=WEEKLY;BYDAY=SU")!;
  const at = (h: number, m = 0) => new Date(2026, 10, 15, h, m);
  const endsAt = categoryEndsAt("10:00:00", 90);

  it("still counts today until the end time", () => {
    expect(endsAt).toBe(690);
    expect(
      days([nextOccurrence(sunday, { from: at(11, 29), endsAt })!]),
    ).toEqual(["2026-11-15"]);
  });

  it("moves on to the next one after it ends", () => {
    expect(
      days([nextOccurrence(sunday, { from: at(11, 30), endsAt })!]),
    ).toEqual(["2026-11-22"]);
  });

  it("counts the whole day without a start time or a length", () => {
    expect(categoryEndsAt("10:00:00", null)).toBeNull();
    expect(categoryEndsAt(null, 90)).toBeNull();
    expect(
      days([nextOccurrence(sunday, { from: at(23), endsAt: null })!]),
    ).toEqual(["2026-11-15"]);
  });
});

describe("nextPeriodStarts", () => {
  const from = d("2026-11-13");
  it("lists the first day of each upcoming week", () => {
    const cadence = parseCadence("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,SU")!;
    // Fri 13 Nov: this week only has Sun 15 left, next week starts Tue 17
    expect(days(nextPeriodStarts(cadence, from))).toEqual([
      "2026-11-15",
      "2026-11-17",
    ]);
  });
});
