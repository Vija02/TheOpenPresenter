// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { useKeyboardInset } from "../lib/useKeyboardInset";

const fakeViewport = () => {
  const viewport = Object.assign(new EventTarget(), {
    height: window.innerHeight,
    offsetTop: 0,
  });
  Object.defineProperty(window, "visualViewport", {
    value: viewport,
    configurable: true,
  });
  return viewport;
};

const cssVar = (name: string) =>
  document.documentElement.style.getPropertyValue(name);

afterEach(() => {
  Object.defineProperty(window, "visualViewport", {
    value: undefined,
    configurable: true,
  });
});

describe("useKeyboardInset", () => {
  it("tracks how much of the screen the keyboard covers", () => {
    const viewport = fakeViewport();
    const { unmount } = renderHook(() => useKeyboardInset());
    expect(cssVar("--keyboard-inset")).toBe("0px");

    // The keyboard opens over the bottom 300px
    act(() => {
      viewport.height = window.innerHeight - 300;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(cssVar("--keyboard-inset")).toBe("300px");
    expect(cssVar("--visible-height")).toBe(`${window.innerHeight - 300}px`);

    unmount();
    expect(cssVar("--keyboard-inset")).toBe("");
  });

  it("does nothing while disabled", () => {
    fakeViewport();
    renderHook(() => useKeyboardInset(false));
    expect(cssVar("--keyboard-inset")).toBe("");
  });

  it("stays set until the last user closes", () => {
    fakeViewport();
    const first = renderHook(() => useKeyboardInset());
    const second = renderHook(() => useKeyboardInset());

    first.unmount();
    expect(cssVar("--keyboard-inset")).toBe("0px");
    second.unmount();
    expect(cssVar("--keyboard-inset")).toBe("");
  });

  it("is on while any dialog is open", async () => {
    fakeViewport();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Details</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(cssVar("--keyboard-inset")).toBe("");

    fireEvent.click(screen.getByText("Open"));
    await screen.findByRole("dialog");
    expect(cssVar("--keyboard-inset")).toBe("0px");
  });
});
