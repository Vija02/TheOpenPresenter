import { randomUUID } from "crypto";

import { store } from "../settings/store";

/** Where a screen is served from. The local runtime's port changes, so it is not stored. */
export type ScreenSource = { kind: "local" } | { kind: "remote"; host: string };

/** A screen this computer shows by itself, without anyone pressing present. */
export type VirtualScreen = {
  id: string;
  source: ScreenSource;
  orgSlug: string;
  screenSlug: string;
  orgName?: string;
  screenName?: string;
  /** Electron display id. Absent means the primary display. */
  monitorId?: string;
  /** The display's label, for when its id changes across reboots. */
  monitorName?: string;
  /** Where the display was, to draw it while it is unplugged. */
  monitorBounds?: { x: number; y: number; width: number; height: number };
  openOnLaunch: boolean;
};

const KEY = "virtualScreens";

export function getVirtualScreens(): VirtualScreen[] {
  return store.get<VirtualScreen[]>(KEY) ?? [];
}

export function saveVirtualScreen(
  input: Omit<VirtualScreen, "id"> & { id?: string },
): VirtualScreen {
  const screens = getVirtualScreens();
  const next: VirtualScreen = { ...input, id: input.id ?? randomUUID() };
  const index = screens.findIndex((s) => s.id === next.id);
  if (index === -1) screens.push(next);
  else screens[index] = next;
  store.set(KEY, screens);
  return next;
}

export function removeVirtualScreen(id: string): void {
  store.set(
    KEY,
    getVirtualScreens().filter((s) => s.id !== id),
  );
}

export function trimHost(host: string): string {
  return host.trim().replace(/\/+$/, "");
}

/** Remote hosts any configured screen loads from. */
export function screenHosts(): string[] {
  return getVirtualScreens().flatMap((s) =>
    s.source.kind === "remote" ? [s.source.host] : [],
  );
}

export function screenUrl(base: string, s: VirtualScreen): string {
  return `${trimHost(base)}/render/s/${encodeURIComponent(s.orgSlug)}/${encodeURIComponent(s.screenSlug)}`;
}

type DisplayLike = { id: number; label?: string };

/** The name a display is listed and remembered by. */
export const displayName = (d: DisplayLike): string =>
  d.label || `Display ${d.id}`;

type Placement = Pick<VirtualScreen, "id" | "monitorId" | "monitorName">;

/**
 * The display each screen belongs on, or null when its display is not
 * connected: a kiosk must not cover the operator's display instead. A screen
 * sticks to its display's id; its name is only trusted when the id changed
 * and exactly one free display, wanted by exactly one screen, has it. No two
 * screens ever share a display.
 */
export function assignDisplays<D extends DisplayLike>(
  screens: Placement[],
  displays: D[],
  primary: D,
): Map<string, D | null> {
  const result = new Map<string, D | null>();
  const taken = new Set<D>();

  for (const s of screens) {
    const d =
      !s.monitorId && !s.monitorName
        ? primary
        : displays.find((d) => String(d.id) === s.monitorId);
    if (d && !taken.has(d)) {
      taken.add(d);
      result.set(s.id, d);
    } else {
      result.set(s.id, null);
    }
  }

  for (const s of screens) {
    if (result.get(s.id) || !s.monitorName) continue;
    const name = s.monitorName;
    // Only a real label: "Display <id>" can't find a display whose id changed.
    const free = displays.filter((d) => !taken.has(d) && d.label === name);
    const wanting = screens.filter(
      (o) => !result.get(o.id) && o.monitorName === name,
    );
    if (free.length === 1 && wanting.length === 1) {
      taken.add(free[0]!);
      result.set(s.id, free[0]!);
    }
  }
  return result;
}

/**
 * Another screen on the display `candidate` would use, so the two would
 * overlap. Matched the way windows are placed, so it agrees with the page.
 */
export function displayTakenBy<D extends DisplayLike>(
  screens: VirtualScreen[],
  candidate: Omit<Placement, "id"> & { id?: string },
  displays: D[],
  primary: D,
): VirtualScreen | undefined {
  const others = screens.filter((s) => s.id !== candidate.id);
  const want = assignDisplays(
    [{ ...candidate, id: "" }],
    displays,
    primary,
  ).get("");
  // An unplugged display: still only one screen may wait for it.
  if (!want) {
    return candidate.monitorId
      ? others.find((s) => s.monitorId === candidate.monitorId)
      : undefined;
  }
  const placed = assignDisplays(others, displays, primary);
  return others.find((s) => placed.get(s.id) === want);
}
