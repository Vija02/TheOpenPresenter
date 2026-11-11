import { describe, expect, it } from "vitest";

import {
  type VirtualScreen,
  assignDisplays,
  displayName,
  displayTakenBy,
  getVirtualScreens,
  removeVirtualScreen,
  saveVirtualScreen,
  screenHosts,
  screenUrl,
} from "../src/main/screens/config";

const primary = { id: 1, label: "eDP-1" };
const projector = { id: 2, label: "HDMI-1" };
const displays = [primary, projector];

describe("displayTakenBy", () => {
  const screen = (
    id: string,
    monitorId?: string,
    monitorName?: string,
  ): VirtualScreen => ({
    id,
    source: { kind: "local" },
    orgSlug: "org",
    screenSlug: id,
    openOnLaunch: true,
    ...(monitorId && { monitorId }),
    ...(monitorName && { monitorName }),
  });
  const screens = [screen("a"), screen("b", "2", "HDMI-1")];
  const taken = (candidate: Parameters<typeof displayTakenBy>[1]) =>
    displayTakenBy(screens, candidate, displays, primary)?.id;

  it("keeps an unplugged display to one screen", () => {
    expect(
      displayTakenBy(
        [screen("c", "99")],
        { monitorId: "99" },
        displays,
        primary,
      )?.id,
    ).toBe("c");
  });

  it("finds the screen already on a display", () => {
    expect(taken({ monitorId: "2" })).toBe("b");
  });

  it("treats no display as the primary, both ways", () => {
    expect(taken({})).toBe("a");
    expect(taken({ monitorId: "1" })).toBe("a");
  });

  it("lets a screen keep its own display", () => {
    expect(taken({ id: "b", monitorId: "2" })).toBe(undefined);
  });

  /** After a reboot renumbers displays, a screen is still where it shows. */
  it("follows a screen found by its display's name", () => {
    const renumbered = { id: 7, label: "HDMI-1" };
    expect(
      displayTakenBy(
        screens,
        { monitorId: "7" },
        [primary, renumbered],
        primary,
      )?.id,
    ).toBe("b");
  });

  it("never counts a display that is not connected", () => {
    expect(taken({ monitorId: "3", monitorName: "DP-9" })).toBe(undefined);
  });
});

describe("assignDisplays", () => {
  const at = (
    id: string,
    monitorId?: string,
    monitorName?: string,
  ): Pick<VirtualScreen, "id" | "monitorId" | "monitorName"> => ({
    id,
    ...(monitorId && { monitorId }),
    ...(monitorName && { monitorName }),
  });
  const placed = (screens: ReturnType<typeof at>[], connected = displays) =>
    Object.fromEntries(
      [...assignDisplays(screens, connected, primary)].map(([id, d]) => [
        id,
        d?.id ?? null,
      ]),
    );

  it("doesn't find an unnamed display by its made-up name", () => {
    const unnamed = [{ id: 7 }, { id: 8 }];
    expect(
      Object.fromEntries(
        [
          ...assignDisplays([at("a", "2", "Display 2")], unnamed, unnamed[0]!),
        ].map(([id, d]) => [id, d?.id ?? null]),
      ),
    ).toEqual({ a: null });
  });

  it("uses the primary display when none was chosen", () => {
    expect(placed([at("a")])).toEqual({ a: 1 });
  });

  it("finds the chosen display by id", () => {
    expect(placed([at("a", "2", "HDMI-1")])).toEqual({ a: 2 });
  });

  /** Display ids are not stable across reboots on every platform. */
  it("falls back to the name when the id changed", () => {
    const renumbered = { id: 7, label: "HDMI-1" };
    expect(placed([at("a", "2", "HDMI-1")], [primary, renumbered])).toEqual({
      a: 7,
    });
  });

  /** Linux often has no label, so the name listed is made from the id. */

  /** A kiosk must not cover the operator's display with the projector feed. */
  it("waits rather than falling back when the display is unplugged", () => {
    expect(placed([at("a", "2", "HDMI-1")], [primary])).toEqual({ a: null });
  });

  /** Two of the same model: a name could be either, so it is neither. */
  it("does not guess between identical monitors", () => {
    const dellA = { id: 11, label: "DELL U2415" };
    const dellB = { id: 12, label: "DELL U2415" };
    expect(
      placed(
        [at("a", "3", "DELL U2415"), at("b", "4", "DELL U2415")],
        [primary, dellA, dellB],
      ),
    ).toEqual({ a: null, b: null });
    // One still found by id leaves the other with the only free one.
    expect(
      placed(
        [at("a", "11", "DELL U2415"), at("b", "4", "DELL U2415")],
        [primary, dellA, dellB],
      ),
    ).toEqual({ a: 11, b: 12 });
  });

  it("never puts two screens on one display", () => {
    expect(placed([at("a"), at("b", "1")])).toEqual({ a: 1, b: null });
  });
});

describe("virtual screen store", () => {
  const base: Omit<VirtualScreen, "id"> = {
    source: { kind: "remote", host: "https://theopenpresenter.com" },
    orgSlug: "grace",
    screenSlug: "main hall",
    openOnLaunch: true,
  };

  it("adds, updates and removes", () => {
    const saved = saveVirtualScreen(base);
    expect(getVirtualScreens().map((s) => s.id)).toContain(saved.id);

    saveVirtualScreen({ ...saved, openOnLaunch: false });
    const updated = getVirtualScreens().filter((s) => s.id === saved.id);
    expect(updated).toHaveLength(1);
    expect(updated[0].openOnLaunch).toBe(false);

    removeVirtualScreen(saved.id);
    expect(getVirtualScreens().some((s) => s.id === saved.id)).toBe(false);
  });

  it("only reports remote hosts as allowed origins", () => {
    const remote = saveVirtualScreen(base);
    const local = saveVirtualScreen({ ...base, source: { kind: "local" } });
    expect(screenHosts()).toEqual(["https://theopenpresenter.com"]);
    removeVirtualScreen(remote.id);
    removeVirtualScreen(local.id);
  });

  it("builds the screen render URL", () => {
    expect(screenUrl("http://127.0.0.1:5678/", { ...base, id: "x" })).toBe(
      "http://127.0.0.1:5678/render/s/grace/main%20hall",
    );
  });
});
