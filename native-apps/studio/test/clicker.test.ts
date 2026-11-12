import { describe, expect, it } from "vitest";

import {
  clickerTarget,
  projectFromUrl,
} from "../src/main/screens/clicker";
import type { VirtualScreen } from "../src/main/screens/config";
import {
  groupDevices,
  isLetter,
  keyFor,
  parseInputDevices,
} from "../src/main/screens/evdev";

const PROC = `I: Bus=0011 Vendor=0001 Product=0001 Version=ab83
N: Name="AT Translated Set 2 keyboard"
P: Phys=isa0060/serio0/input0
H: Handlers=sysrq kbd leds event3
B: EV=120013

I: Bus=0003 Vendor=1d57 Product=ad03 Version=0110
N: Name="Wireless Presenter Keyboard"
H: Handlers=sysrq kbd leds event7
B: EV=120013

I: Bus=0003 Vendor=1d57 Product=ad03 Version=0110
N: Name="Wireless Presenter Keyboard Consumer Control"
H: Handlers=kbd event8
B: EV=1f

I: Bus=0003 Vendor=1d57 Product=ad03 Version=0110
N: Name="Wireless Presenter Mouse"
H: Handlers=mouse2 event9
B: EV=17

I: Bus=0019 Vendor=0000 Product=0000 Version=0000
N: Name="Video Bus"
H: Handlers=kbd event5
B: EV=3
`;

describe("parseInputDevices", () => {
  it("keeps keyboard-like nodes only", () => {
    expect(parseInputDevices(PROC).map((n) => n.path)).toEqual([
      "/dev/input/event3",
      "/dev/input/event7",
      "/dev/input/event8",
      "/dev/input/event5",
    ]);
  });

  it("groups a clicker's nodes into one device", () => {
    expect(groupDevices(parseInputDevices(PROC))).toEqual([
      {
        id: "0001:0001",
        name: "AT Translated Set 2 keyboard",
        paths: ["/dev/input/event3"],
      },
      {
        id: "1d57:ad03",
        name: "Wireless Presenter Keyboard",
        paths: ["/dev/input/event7", "/dev/input/event8"],
      },
      { id: "name:Video Bus", name: "Video Bus", paths: ["/dev/input/event5"] },
    ]);
  });
});

describe("keyFor", () => {
  it("maps page and arrow keys", () => {
    expect(keyFor(109)).toBe("NEXT");
    expect(keyFor(106)).toBe("NEXT");
    expect(keyFor(104)).toBe("PREV");
    expect(keyFor(105)).toBe("PREV");
    expect(keyFor(30)).toBeNull();
  });

  it("tells letters from a clicker's other keys", () => {
    expect(isLetter(30)).toBe(true); // A
    expect(isLetter(50)).toBe(true); // M
    expect(isLetter(109)).toBe(false); // Page Down
    expect(isLetter(1)).toBe(false); // Esc
    expect(isLetter(63)).toBe(false); // F5
  });
});

describe("clickerTarget", () => {
  const screen = (id: string): VirtualScreen => ({
    id,
    source: { kind: "local" },
    orgSlug: "org",
    screenSlug: id,
    openOnLaunch: true,
  });

  it("drives the open project when asked", () => {
    expect(
      clickerTarget({ enabled: true, target: "project" }, [screen("a")]),
    ).toEqual({ kind: "project" });
  });

  it("drives the open project when there are no screens", () => {
    expect(clickerTarget({ enabled: true }, [])).toEqual({ kind: "project" });
  });

  it("needs a choice between several screens", () => {
    expect(clickerTarget({ enabled: true }, [screen("a"), screen("b")])).toBe(
      null,
    );
  });

  it("doesn't move something else once the chosen screen is gone", () => {
    expect(
      clickerTarget({ enabled: true, target: "screen", screenId: "gone" }, []),
    ).toBeNull();
    expect(
      clickerTarget({ enabled: true, screenId: "gone" }, [screen("a")]),
    ).toBeNull();
  });

  it("uses the only screen when none was chosen", () => {
    expect(clickerTarget({ enabled: true }, [screen("a")])).toMatchObject({
      kind: "screen",
      screen: { id: "a" },
    });
  });

  it("drives the chosen screen", () => {
    expect(
      clickerTarget({ enabled: true, target: "screen", screenId: "b" }, [
        screen("a"),
        screen("b"),
      ]),
    ).toMatchObject({ kind: "screen", screen: { id: "b" } });
  });
});

describe("projectFromUrl", () => {
  it("reads the project from the app window's address", () => {
    expect(
      projectFromUrl("http://127.0.0.1:41234/app/hope-church/sunday-service"),
    ).toEqual({
      base: "http://127.0.0.1:41234",
      orgSlug: "hope-church",
      projectSlug: "sunday-service",
    });
    expect(
      projectFromUrl("https://theopenpresenter.com/app/org/my%20proj/settings?x=1"),
    ).toMatchObject({ base: "https://theopenpresenter.com", projectSlug: "my proj" });
  });

  it("is nothing on other pages", () => {
    expect(projectFromUrl("https://theopenpresenter.com/o/org")).toBeNull();
    expect(projectFromUrl("https://theopenpresenter.com/app/org")).toBeNull();
    expect(projectFromUrl("file:///index.html")).toBeNull();
  });
});
