import { describe, expect, it } from "vitest";

import {
  SequenceAnchor,
  getNextItemId,
  getPreviousItemId,
  rebaseAnchor,
  resolveSequence,
} from "../sequence";

const items = [
  { id: "a", duration: 10 },
  { id: "b", duration: 20 },
  { id: "c", duration: 30 },
];

const anchor = (overrides?: Partial<SequenceAnchor>): SequenceAnchor => ({
  itemId: "a",
  uid: "u",
  isPlaying: true,
  seek: 0,
  startedAt: 0,
  ...overrides,
});

const at = (seconds: number) => seconds * 1000;

describe("resolveSequence", () => {
  it("plays the anchor item from its seek position", () => {
    const resolved = resolveSequence(
      items,
      anchor({ seek: 0.5 }),
      { repeat: "off" },
      at(2),
    );
    expect(resolved).toMatchObject({
      itemId: "a",
      isPlaying: true,
      currentTimeSeconds: 7,
      nextChangeAt: at(5),
    });
  });

  it("moves on to the following items as time passes", () => {
    const resolved = resolveSequence(
      items,
      anchor(),
      { repeat: "off" },
      at(25),
    );
    expect(resolved).toMatchObject({
      itemId: "b",
      index: 1,
      currentTimeSeconds: 15,
      nextChangeAt: at(30),
    });
    // Starts fresh, at the moment it began
    expect(resolved.playbackState).toMatchObject({
      uid: "u:1",
      seek: 0,
      startedAt: at(10),
      isPlaying: true,
    });
  });

  it("ends after the last item when not repeating", () => {
    const resolved = resolveSequence(
      items,
      anchor(),
      { repeat: "off" },
      at(100),
    );
    expect(resolved).toMatchObject({
      itemId: "c",
      isPlaying: false,
      isEnded: true,
      nextChangeAt: null,
    });
  });

  it("wraps around when repeating all", () => {
    // One lap is 60s
    const resolved = resolveSequence(
      items,
      anchor(),
      { repeat: "all" },
      at(65),
    );
    expect(resolved).toMatchObject({ itemId: "a", currentTimeSeconds: 5 });
    expect(resolved.playbackState.uid).toBe("u:3");
  });

  it("repeats the anchor item when repeating one", () => {
    const resolved = resolveSequence(
      items,
      anchor({ itemId: "b" }),
      { repeat: "one" },
      at(45),
    );
    expect(resolved).toMatchObject({
      itemId: "b",
      currentTimeSeconds: 5,
      nextChangeAt: at(60),
    });
    expect(resolved.playbackState.uid).toBe("u:2");
  });

  it("skips whole laps instead of walking them", () => {
    const aWeek = 7 * 24 * 60 * 60;
    const resolved = resolveSequence(
      [{ id: "a", duration: 1 }],
      anchor(),
      { repeat: "one" },
      at(aWeek + 0.5),
    );
    expect(resolved.itemId).toBe("a");
    expect(resolved.currentTimeSeconds).toBeCloseTo(0.5);
    expect(resolved.playbackState.uid).toBe(`u:${aWeek}`);
  });

  it("stays put while paused", () => {
    const resolved = resolveSequence(
      items,
      anchor({ itemId: "b", isPlaying: false, seek: 0.25 }),
      { repeat: "off" },
      at(1000),
    );
    expect(resolved).toMatchObject({
      itemId: "b",
      isPlaying: false,
      currentTimeSeconds: 5,
      nextChangeAt: null,
    });
  });

  it("plays on through an item with no known duration", () => {
    const withUnknown = [items[0]!, { id: "x" }, items[2]!];
    const resolved = resolveSequence(
      withUnknown,
      anchor(),
      { repeat: "off" },
      at(500),
    );
    expect(resolved).toMatchObject({
      itemId: "x",
      isPlaying: true,
      currentTimeSeconds: 490,
      nextChangeAt: null,
    });
  });

  it("is idle without a known anchor item", () => {
    expect(
      resolveSequence(items, anchor({ itemId: null }), { repeat: "all" })
        .itemId,
    ).toBe(null);
    expect(
      resolveSequence(items, anchor({ itemId: "gone" }), { repeat: "all" })
        .itemId,
    ).toBe(null);
    expect(resolveSequence([], anchor(), { repeat: "all" }).itemId).toBe(null);
  });
});

describe("rebaseAnchor", () => {
  it("captures the derived position so it can be resolved again later", () => {
    const now = at(25);
    const resolved = resolveSequence(items, anchor(), { repeat: "off" }, now);
    const rebased = { ...rebaseAnchor(resolved, now), uid: "v" };

    expect(rebased).toMatchObject({ itemId: "b", seek: 0.75, startedAt: now });
    // The same moment resolves to the same place from either anchor
    expect(
      resolveSequence(items, rebased, { repeat: "off" }, at(40)),
    ).toMatchObject({
      itemId: "c",
      currentTimeSeconds: 10,
    });
    expect(
      resolveSequence(items, anchor(), { repeat: "off" }, at(40)),
    ).toMatchObject({
      itemId: "c",
      currentTimeSeconds: 10,
    });
  });

  it("keeps a finished sequence finished when items are added after it", () => {
    const now = at(100);
    const rebased = {
      ...rebaseAnchor(
        resolveSequence(items, anchor(), { repeat: "off" }, now),
        now,
      ),
      uid: "v",
    };
    expect(rebased).toMatchObject({ itemId: "c", isPlaying: false });

    const longer = [...items, { id: "d", duration: 10 }];
    expect(
      resolveSequence(longer, rebased, { repeat: "off" }, at(200)),
    ).toMatchObject({
      itemId: "c",
      isPlaying: false,
    });
  });
});

describe("continuous rebasing", () => {
  it.each([
    ["the anchor item", 5],
    ["a later item", 25],
    ["a later lap", 125],
  ])("leaves the player untouched while on %s", (_, seconds) => {
    const now = at(seconds);
    const before = resolveSequence(items, anchor(), { repeat: "all" }, now);
    const rebased = rebaseAnchor(before, now);
    const after = resolveSequence(items, rebased, { repeat: "all" }, now);

    expect(after.itemId).toBe(before.itemId);
    expect(after.playbackState.uid).toBe(before.playbackState.uid);
    expect(after.playbackState.startedAt).toBeCloseTo(
      before.playbackState.startedAt,
    );
  });

  it("still gives the next item its own uid", () => {
    const now = at(25);
    const rebased = rebaseAnchor(
      resolveSequence(items, anchor(), { repeat: "all" }, now),
      now,
    );
    const later = resolveSequence(items, rebased, { repeat: "all" }, at(35));

    expect(later.itemId).toBe("c");
    expect(later.playbackState.uid).not.toBe(rebased.uid);
  });
});

describe("crossfade", () => {
  // a → b overlap 4s, so b starts at 6s. b → c too, so c starts at 22s
  const fade4 = { repeat: "off", crossfade: 4 } as const;

  it("starts the next item early and loads it ahead", () => {
    const resolved = resolveSequence(items, anchor(), fade4, at(3));
    expect(resolved).toMatchObject({
      itemId: "a",
      fade: null,
      outgoing: null,
      upcoming: { itemId: "b", startsAt: at(6) },
      nextChangeAt: at(6),
    });
  });

  it("fades the previous item out under the next one", () => {
    const resolved = resolveSequence(items, anchor(), fade4, at(7));
    expect(resolved).toMatchObject({
      itemId: "b",
      currentTimeSeconds: 1,
      fade: { startsAt: at(6), endsAt: at(10) },
      outgoing: {
        itemId: "a",
        playbackState: { uid: "u", isPlaying: true, startedAt: 0 },
        fade: { startsAt: at(6), endsAt: at(10) },
      },
      upcoming: { itemId: "c", startsAt: at(22) },
      nextChangeAt: at(10),
    });
    expect(resolved.playbackState).toMatchObject({
      uid: "u:1",
      startedAt: at(6),
    });
  });

  it("drops the outgoing item once the fade is over", () => {
    const resolved = resolveSequence(items, anchor(), fade4, at(11));
    expect(resolved).toMatchObject({
      itemId: "b",
      fade: null,
      outgoing: null,
      nextChangeAt: at(22),
    });
  });

  it("plays the last item to its very end", () => {
    expect(resolveSequence(items, anchor(), fade4, at(51))).toMatchObject({
      itemId: "c",
      isPlaying: true,
      upcoming: null,
      nextChangeAt: at(52),
    });
    expect(resolveSequence(items, anchor(), fade4, at(53)).isEnded).toBe(true);
  });

  it("keeps half of a short item to itself", () => {
    const resolved = resolveSequence(
      items,
      anchor(),
      { repeat: "off", crossfade: 12 },
      at(1),
    );
    // a is 10s long, so it fades for 5s
    expect(resolved.upcoming).toEqual({ itemId: "b", startsAt: at(5) });
  });

  it("doesn't fade an item into itself", () => {
    const resolved = resolveSequence(
      items,
      anchor(),
      { repeat: "one", crossfade: 4 },
      at(11),
    );
    expect(resolved).toMatchObject({
      itemId: "a",
      currentTimeSeconds: 1,
      outgoing: null,
      upcoming: null,
    });
  });

  it("fades across the wrap and skips whole laps the same way", () => {
    const fadeAll = { repeat: "all", crossfade: 4 } as const;
    // One lap is 60s less three 4s overlaps
    const lap = at(48);
    const first = resolveSequence(items, anchor(), fadeAll, at(50));
    const later = resolveSequence(items, anchor(), fadeAll, at(50) + 10 * lap);

    expect(first).toMatchObject({
      itemId: "a",
      currentTimeSeconds: 2,
      outgoing: { itemId: "c", fade: { startsAt: at(48), endsAt: at(52) } },
    });
    expect(later).toMatchObject({
      itemId: "a",
      currentTimeSeconds: 2,
      outgoing: {
        itemId: "c",
        playbackState: { startedAt: at(22) + 10 * lap },
        fade: { startsAt: at(48) + 10 * lap },
      },
    });
    expect(later.outgoing!.playbackState.uid).toBe("u:32");
    expect(later.playbackState.uid).toBe("u:33");
  });

  it("carries on with a fade after a rebase", () => {
    const rebased = rebaseAnchor(
      resolveSequence(items, anchor(), fade4, at(7)),
      at(7),
    );

    const original = resolveSequence(items, anchor(), fade4, at(8));
    const resumed = resolveSequence(items, rebased, fade4, at(8));
    expect(resumed.itemId).toBe(original.itemId);
    expect(resumed.playbackState).toEqual(original.playbackState);
    expect(resumed.fade).toEqual(original.fade);
    expect(resumed.outgoing).toEqual(original.outgoing);
    expect(resumed.nextChangeAt).toBe(original.nextChangeAt);

    expect(resolveSequence(items, rebased, fade4, at(11)).outgoing).toBeNull();
  });

  it("forgets an outgoing item that was removed", () => {
    const rebased = rebaseAnchor(
      resolveSequence(items, anchor(), fade4, at(7)),
      at(7),
    );
    const resolved = resolveSequence(
      items.filter((x) => x.id !== "a"),
      rebased,
      fade4,
      at(8),
    );
    expect(resolved).toMatchObject({ itemId: "b", outgoing: null, fade: null });
  });
});

describe("getNextItemId", () => {
  it("follows the repeat mode", () => {
    expect(getNextItemId(items, "a", "off")).toBe("b");
    expect(getNextItemId(items, "c", "off")).toBeNull();
    expect(getNextItemId(items, "c", "all")).toBe("a");
    expect(getNextItemId(items, "b", "one")).toBe("b");
    expect(getNextItemId([], "a", "all")).toBeNull();
  });
});

describe("getPreviousItemId", () => {
  it("moves back and wraps to the end", () => {
    expect(getPreviousItemId(items, "b")).toBe("a");
    expect(getPreviousItemId(items, "a")).toBe("c");
    expect(getPreviousItemId([], null)).toBeNull();
  });
});
