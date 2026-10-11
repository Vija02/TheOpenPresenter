import { useCallback, useMemo, useState } from "react";

import { normalizeSemitones } from "../../../src/musician/chart";

export type MusicianTheme = "dark" | "light";

/** For all songs, or one song's own */
type StoredStyle = {
  /** When on, fontSize is unused */
  autoFit: boolean;
  /** px. Null for this device's default */
  fontSize: number | null;
  autoScroll: boolean;
};

/** Saved per device */
type StoredSettings = {
  showChords: boolean;
  theme: MusicianTheme;
  /** Off: no live highlight, Follow button or following the screen */
  followVisual: boolean;
  /** Refollow when the song gone ahead to goes live */
  autoFollow: boolean;
  style: StoredStyle;
  /** By song id; songs without one use `style` */
  songStyles: Record<string, StoredStyle>;
  /** Semitones, by song id */
  transpose: Record<string, number>;
};

export type StyleScope = "all" | "song";

/** For the song being shown */
export type MusicianSettings = Pick<
  StoredSettings,
  "showChords" | "theme" | "followVisual" | "autoFollow" | "transpose"
> &
  Omit<StoredStyle, "fontSize"> & {
    /** px */
    fontSize: number;
    isDefaultFontSize: boolean;
    styleScope: StyleScope;
  };

export type MusicianSettingsPatch = Partial<
  Pick<StoredSettings, "showChords" | "theme" | "followVisual" | "autoFollow">
>;

/** A null fontSize resets to this device's default */
export type StylePatch = Partial<StoredStyle>;

const STORAGE_KEY = "lyrics-presenter.musician-view";

export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 48;
export const FONT_STEP = 2;

/** A phone is held close; a tablet or laptop sits further away on a stand */
const PHONE_FONT_SIZE = 16;
const LARGE_SCREEN_FONT_SIZE = 22;

/** Either way up, a phone is under 600px across its short side */
const isPhone = () => Math.min(window.innerWidth, window.innerHeight) < 600;

/** Fitting a whole song on a phone makes the text too small */
const defaultStyle = (): StoredStyle => ({
  autoFit: !isPhone(),
  fontSize: null,
  autoScroll: true,
});

const defaults = (): StoredSettings => ({
  showChords: true,
  theme: "dark",
  followVisual: true,
  autoFollow: true,
  style: defaultStyle(),
  songStyles: {},
  transpose: {},
});

const loadStyle = (raw: unknown): StoredStyle => {
  const parsed = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<keyof StoredStyle, unknown>
  >;
  const fallback = defaultStyle();
  return {
    autoFit:
      typeof parsed.autoFit === "boolean" ? parsed.autoFit : fallback.autoFit,
    fontSize:
      typeof parsed.fontSize === "number"
        ? Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parsed.fontSize))
        : null,
    autoScroll:
      typeof parsed.autoScroll === "boolean"
        ? parsed.autoScroll
        : fallback.autoScroll,
  };
};

const loadSongStyles = (raw: unknown): Record<string, StoredStyle> => {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw).map(([songId, style]) => [songId, loadStyle(style)]),
  );
};

const loadTranspose = (raw: unknown): Record<string, number> => {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [songId, semitones] of Object.entries(raw)) {
    if (typeof semitones !== "number" || !Number.isFinite(semitones)) continue;
    const normalized = normalizeSemitones(Math.round(semitones));
    if (normalized !== 0) out[songId] = normalized;
  }
  return out;
};

const load = (): StoredSettings => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    return {
      showChords:
        typeof parsed.showChords === "boolean" ? parsed.showChords : true,
      theme:
        parsed.theme === "dark" || parsed.theme === "light"
          ? parsed.theme
          : "dark",
      followVisual:
        typeof parsed.followVisual === "boolean" ? parsed.followVisual : true,
      autoFollow:
        typeof parsed.autoFollow === "boolean" ? parsed.autoFollow : true,
      style: loadStyle(parsed.style),
      songStyles: loadSongStyles(parsed.songStyles),
      transpose: loadTranspose(parsed.transpose),
    };
  } catch {
    return defaults();
  }
};

const without = <T>(record: Record<string, T>, key: string) => {
  const next = { ...record };
  delete next[key];
  return next;
};

const save = (settings: StoredSettings) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private windows and blocked storage: it just isn't remembered
  }
};

/** Settings for `songId`, the song being shown */
export const useMusicianSettings = (songId: string | null) => {
  const [stored, setStored] = useState(load);
  const [defaultFontSize] = useState(() =>
    isPhone() ? PHONE_FONT_SIZE : LARGE_SCREEN_FONT_SIZE,
  );

  const settings = useMemo((): MusicianSettings => {
    const songStyle = songId ? stored.songStyles[songId] : undefined;
    const style = songStyle ?? stored.style;
    return {
      showChords: stored.showChords,
      theme: stored.theme,
      followVisual: stored.followVisual,
      autoFollow: stored.autoFollow,
      transpose: stored.transpose,
      autoFit: style.autoFit,
      autoScroll: style.autoScroll,
      fontSize: style.fontSize ?? defaultFontSize,
      isDefaultFontSize: style.fontSize === null,
      styleScope: songStyle ? "song" : "all",
    };
  }, [stored, songId, defaultFontSize]);

  const change = useCallback(
    (next: (current: StoredSettings) => StoredSettings) =>
      setStored((current) => {
        const updated = next(current);
        save(updated);
        return updated;
      }),
    [],
  );

  const update = useCallback(
    (patch: MusicianSettingsPatch) =>
      change((current) => ({ ...current, ...patch })),
    [change],
  );

  /** Changes the song's own style, if it has one, or every song's */
  const updateStyle = useCallback(
    (patch: StylePatch) =>
      change((current) => {
        const songStyle = songId ? current.songStyles[songId] : undefined;
        if (songId && songStyle) {
          return {
            ...current,
            songStyles: {
              ...current.songStyles,
              [songId]: { ...songStyle, ...patch },
            },
          };
        }
        return { ...current, style: { ...current.style, ...patch } };
      }),
    [change, songId],
  );

  /** "song" copies the all-songs style as the song's own; "all" drops it */
  const setStyleScope = useCallback(
    (scope: StyleScope) =>
      change((current) => {
        if (!songId) return current;
        return {
          ...current,
          songStyles:
            scope === "song"
              ? {
                  ...current.songStyles,
                  [songId]: current.songStyles[songId] ?? current.style,
                }
              : without(current.songStyles, songId),
        };
      }),
    [change, songId],
  );

  const setTranspose = useCallback(
    (id: string, semitones: number) =>
      change((current) => {
        const normalized = normalizeSemitones(semitones);
        return {
          ...current,
          transpose:
            normalized === 0
              ? without(current.transpose, id)
              : { ...current.transpose, [id]: normalized },
        };
      }),
    [change],
  );

  return {
    settings,
    update,
    updateStyle,
    setStyleScope,
    setTranspose,
  };
};
