// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Select } from "../components/ui/select";

// A phone-sized screen: nothing matches the desktop breakpoint
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, "");
});

describe("Select on a phone", () => {
  it("shows the chosen option when values are objects", () => {
    const options = [
      { label: "First", value: { id: 1 } },
      { label: "Second", value: { id: 2 } },
    ];
    // A fresh option for the same value, as callers often build one
    const value = { label: "Second", value: options[1]!.value };
    render(<Select aria-label="Pick" options={options} value={value} />);

    const select = screen.getByRole("combobox", { name: "Pick" });
    expect(select.tagName).toBe("SELECT");
    expect((select as HTMLSelectElement).selectedOptions[0]?.textContent).toBe(
      "Second",
    );
  });
});

describe("Dialog on a phone", () => {
  it("closes on back even when only a trigger opens it", async () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Details</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByText("Open"));
    await screen.findByRole("dialog");
    expect(window.history.state?.__overlay).toBeTruthy();

    // Back: the browser lands on the entry before the dialog's
    await act(async () => {
      window.history.replaceState(null, "");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
