import { BrowserWindow } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isShowingServer,
  reloadServerWindows,
} from "../src/main/shell/windows";

vi.mock("../src/main/shell/origins", () => ({
  isAllowedAppUrl: () => true,
}));

type FakeWindow = {
  url: string;
  reloaded: number;
  loaded: string[];
};

/** Windows as `BrowserWindow.getAllWindows()` would return them. */
function windows(...urls: string[]): FakeWindow[] {
  const fakes = urls.map((url) => ({
    url,
    reloaded: 0,
    loaded: [] as string[],
  }));
  (
    BrowserWindow as unknown as { getAllWindows: () => unknown[] }
  ).getAllWindows = () =>
    fakes.map((fake) => ({
      isDestroyed: () => false,
      loadURL: (target: string) => {
        fake.loaded.push(target);
        return Promise.resolve();
      },
      webContents: {
        getURL: () => fake.url,
        reload: () => {
          fake.reloaded += 1;
        },
      },
    }));
  return fakes;
}

afterEach(() => {
  windows();
});

describe("after the local server restarts", () => {
  it("reloads only the windows that were showing it", () => {
    const [app, present, shell] = windows(
      "http://localhost:45231/o/my-church/project/1",
      "http://localhost:45231/render/1",
      "file:///app/onboarding.html",
    );

    reloadServerWindows("http://localhost:45231", "http://localhost:45231");

    expect(app!.reloaded).toBe(1);
    expect(present!.reloaded).toBe(1);
    expect(shell!.reloaded).toBe(0);
  });

  it("keeps each window's page when the port changed", () => {
    const [app] = windows("http://localhost:45231/o/my-church?tab=2#x");

    reloadServerWindows("http://localhost:45231", "http://localhost:50000");

    expect(app!.reloaded).toBe(0);
    expect(app!.loaded).toEqual(["http://localhost:50000/o/my-church?tab=2#x"]);
  });

  it("leaves other servers alone", () => {
    const [cloud] = windows("https://theopenpresenter.com/o/my-church");

    reloadServerWindows("http://localhost:45231", "http://localhost:45231");

    expect(cloud!.reloaded).toBe(0);
    expect(cloud!.loaded).toEqual([]);
  });
});

describe("isShowingServer", () => {
  it("matches on origin, not the exact page", () => {
    windows("http://localhost:45231/o/my-church");
    expect(isShowingServer("http://localhost:45231")).toBe(true);
    expect(isShowingServer("http://localhost:45232")).toBe(false);
    expect(isShowingServer("not a url")).toBe(false);
  });
});
