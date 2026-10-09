/**
 * Plays a list of items back to back, derived from an anchor (which item was
 * playing, from where and when) plus the clock. So playback keeps advancing
 * with no server involved, and the anchor only changes on a user action.
 *
 * Before changing the anchor, `rebaseAnchor` to pin down where playback has
 * got to. Keep its uid when nothing audible changes, so players don't resync.
 *
 * Nothing here is media specific, so anything that needs sequencing can use it.
 */

export type SequenceItem = {
  id: string;
  /** In seconds. Unknown durations play until something changes */
  duration?: number;
};

export type SequenceRepeat = "off" | "all" | "one";

export type SequenceOptions = {
  repeat: SequenceRepeat;
  /** Seconds each item overlaps the next by, fading from one to the other */
  crossfade?: number;
};

/** Epoch ms */
export type SequenceFade = { startsAt: number; endsAt: number };

export type SequencePlaybackState = {
  uid: string;
  isPlaying: boolean;
  seek: number;
  startedAt: number;
  onFinishBehaviour: "pause";
};

/** An item fading out under the next one */
export type SequenceOutgoing = {
  itemId: string;
  playbackState: SequencePlaybackState;
  fade: SequenceFade;
};

export type SequenceAnchor = {
  itemId: string | null;
  uid: string;
  isPlaying: boolean;
  /** Position within the anchor item, as a fraction (0 to 1) */
  seek: number;
  /** Epoch ms of the action that set this anchor */
  startedAt: number;
  /** Pinned partway through a crossfade, so the item fading out carries on */
  outgoing?: SequenceOutgoing | null;
};

export type ResolvedSequence = {
  itemId: string | null;
  index: number;
  isPlaying: boolean;
  /** The sequence ran off the end with repeat off */
  isEnded: boolean;
  currentTimeSeconds: number;
  /** Position within the current item, as a fraction (0 to 1) */
  seek: number;
  /** For a VideoPlayer. Its uid changes every time an item starts over */
  playbackState: SequencePlaybackState;
  /** While the current item fades in */
  fade: SequenceFade | null;
  /** The previous item, while it fades out */
  outgoing: SequenceOutgoing | null;
  /** The item that plays next and when, so players can load it early */
  upcoming: { itemId: string; startsAt: number } | null;
  /** Epoch ms when the result next changes on its own, or null if it won't */
  nextChangeAt: number | null;
};

const still = {
  fade: null,
  outgoing: null,
  upcoming: null,
  nextChangeAt: null,
} as const;

const idle = (anchor: SequenceAnchor): ResolvedSequence => ({
  itemId: null,
  index: -1,
  isPlaying: false,
  isEnded: false,
  currentTimeSeconds: 0,
  seek: 0,
  playbackState: {
    uid: anchor.uid,
    isPlaying: false,
    seek: 0,
    startedAt: anchor.startedAt,
    onFinishBehaviour: "pause",
  },
  ...still,
});

export const resolveSequence = (
  items: SequenceItem[],
  anchor: SequenceAnchor,
  { repeat, crossfade = 0 }: SequenceOptions,
  now: number = Date.now(),
): ResolvedSequence => {
  const anchorIndex = items.findIndex((x) => x.id === anchor.itemId);
  if (anchorIndex === -1) return idle(anchor);

  const anchorDuration = items[anchorIndex]!.duration;

  if (!anchor.isPlaying || !anchorDuration) {
    const isPlaying = anchor.isPlaying;
    const currentTimeSeconds = anchorDuration
      ? anchor.seek * anchorDuration
      : isPlaying
        ? Math.max(0, (now - anchor.startedAt) / 1000)
        : 0;

    return {
      itemId: anchor.itemId,
      index: anchorIndex,
      isPlaying,
      isEnded: false,
      currentTimeSeconds,
      seek: anchor.seek,
      playbackState: {
        uid: anchor.uid,
        isPlaying,
        seek: anchor.seek,
        startedAt: anchor.startedAt,
        onFinishBehaviour: "pause",
      },
      ...still,
    };
  }

  // Everything below is measured in seconds from when the anchor item began
  const originMs = anchor.startedAt - anchor.seek * anchorDuration * 1000;
  const elapsed = Math.max(0, (now - originMs) / 1000);

  const following = (index: number) => {
    if (repeat === "one") return index;
    if (index + 1 < items.length) return index + 1;
    return repeat === "all" ? 0 : -1;
  };
  // Never into itself, and short items keep at least half to themselves
  const overlapAfter = (index: number) => {
    const from = items[index]!;
    const to = items[following(index)];
    if (!to || to.id === from.id || !from.duration) return 0;
    return Math.min(
      crossfade,
      from.duration / 2,
      to.duration ? to.duration / 2 : Infinity,
    );
  };

  let index = anchorIndex;
  let itemStart = 0;
  let occurrence = 0;
  let hasFastForwarded = false;
  const uidOf = (occurrence: number) =>
    occurrence === 0 ? anchor.uid : `${anchor.uid}:${occurrence}`;
  const toMs = (seconds: number) => originMs + seconds * 1000;

  // The item we moved on from, while it overlaps the current one
  let previous: {
    index: number;
    itemStart: number;
    occurrence: number;
    overlap: number;
  } | null = null;

  const currentOutgoing = (): SequenceOutgoing | null => {
    if (!previous) {
      const outgoing = occurrence === 0 ? anchor.outgoing : null;
      return outgoing && items.some((x) => x.id === outgoing.itemId)
        ? outgoing
        : null;
    }
    if (previous.overlap === 0) return null;

    const startsAt = toMs(itemStart);
    return {
      itemId: items[previous.index]!.id,
      playbackState: {
        uid: uidOf(previous.occurrence),
        isPlaying: true,
        seek: 0,
        startedAt: toMs(previous.itemStart),
        onFinishBehaviour: "pause",
      },
      fade: { startsAt, endsAt: startsAt + previous.overlap * 1000 },
    };
  };

  while (true) {
    const item = items[index]!;
    const duration = item.duration;
    const nextIndex = following(index);
    const nextStart = duration
      ? itemStart + duration - overlapAfter(index)
      : null;

    // Without a duration we can't know when it ends, so it plays until someone acts
    if (nextStart === null || elapsed < nextStart) {
      const outgoing = currentOutgoing();
      const isFading = !!outgoing && now < outgoing.fade.endsAt;
      const upcoming =
        nextStart !== null &&
        nextIndex !== -1 &&
        items[nextIndex]!.id !== item.id
          ? { itemId: items[nextIndex]!.id, startsAt: toMs(nextStart) }
          : null;
      const currentTimeSeconds = elapsed - itemStart;

      return {
        itemId: item.id,
        index,
        isPlaying: true,
        isEnded: false,
        currentTimeSeconds,
        seek: duration ? currentTimeSeconds / duration : 0,
        playbackState: {
          uid: uidOf(occurrence),
          isPlaying: true,
          seek: 0,
          startedAt: toMs(itemStart),
          onFinishBehaviour: "pause",
        },
        fade: isFading ? outgoing.fade : null,
        outgoing: isFading ? outgoing : null,
        upcoming,
        nextChangeAt: isFading
          ? Math.min(outgoing.fade.endsAt, upcoming?.startsAt ?? Infinity)
          : (upcoming?.startsAt ??
            (nextStart === null ? null : toMs(nextStart))),
      };
    }

    if (nextIndex === -1) {
      return {
        itemId: item.id,
        index,
        isPlaying: false,
        isEnded: true,
        currentTimeSeconds: duration!,
        seek: 1,
        playbackState: {
          uid: uidOf(occurrence),
          isPlaying: false,
          seek: 1,
          startedAt: toMs(nextStart),
          onFinishBehaviour: "pause",
        },
        ...still,
      };
    }

    previous = {
      index,
      itemStart,
      occurrence,
      overlap: overlapAfter(index),
    };
    itemStart = nextStart;

    // Repeating for hours shouldn't mean walking every lap, so skip whole ones
    if (!hasFastForwarded && (repeat === "one" || nextIndex === 0)) {
      hasFastForwarded = true;
      const cycle =
        repeat === "one" ? [index] : items.map((_, cycleIndex) => cycleIndex);
      const allKnown = cycle.every((x) => !!items[x]!.duration);
      const cycleSeconds = cycle.reduce(
        (sum, x) => sum + (items[x]!.duration ?? 0) - overlapAfter(x),
        0,
      );

      if (allKnown && cycleSeconds > 0) {
        const laps = Math.floor((elapsed - itemStart) / cycleSeconds);
        const skipped = laps * cycleSeconds;
        itemStart += skipped;
        occurrence += laps * cycle.length;
        previous.itemStart += skipped;
        previous.occurrence += laps * cycle.length;
      }
    }

    index = nextIndex;
    occurrence++;
  }
};

/**
 * An anchor that resolves to the very same playback. When the action that
 * follows makes playback jump, override `uid` and drop `outgoing`
 */
export const rebaseAnchor = (
  resolved: ResolvedSequence,
  now: number = Date.now(),
): SequenceAnchor => ({
  itemId: resolved.itemId,
  uid: resolved.playbackState.uid,
  isPlaying: resolved.isPlaying,
  seek: resolved.seek,
  startedAt: now,
  outgoing: resolved.outgoing,
});

/** The item after `currentId`, or null at the end without repeat */
export const getNextItemId = (
  items: Pick<SequenceItem, "id">[],
  currentId: string | null,
  repeat: SequenceRepeat,
): string | null => {
  if (items.length === 0) return null;

  const index = items.findIndex((x) => x.id === currentId);
  if (index === -1) return items[0]!.id;
  if (repeat === "one") return currentId;

  const next = items[index + 1];
  if (next) return next.id;

  return repeat === "all" ? items[0]!.id : null;
};

/** The item before `currentId`, wrapping around to the end */
export const getPreviousItemId = (
  items: Pick<SequenceItem, "id">[],
  currentId: string | null,
): string | null => {
  if (items.length === 0) return null;

  const index = items.findIndex((x) => x.id === currentId);
  if (index === -1) return items[0]!.id;

  return items[(index - 1 + items.length) % items.length]!.id;
};
