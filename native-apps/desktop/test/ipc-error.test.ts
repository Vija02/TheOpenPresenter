import { describe, expect, it } from "vitest";

import { ipcErrorMessage as strip } from "../src/renderer/bridge/ipc";

/**
 * Electron wraps anything an `ipcMain.handle` callback throws, so the message
 * a panel shows is prefixed with plumbing the user should never read. The
 * bridge strips that; these are the exact shapes Electron produces.
 */

describe("stripping Electron's IPC error wrapper", () => {
  it("keeps only the message the handler wrote", () => {
    expect(
      strip(
        "Error invoking remote method 'app:switch-server': Error: Could not reach presenter.example.org. Check the address and that the instance is running.",
      ),
    ).toBe(
      "Could not reach presenter.example.org. Check the address and that the instance is running.",
    );
  });

  /** Subclassed and namespaced error names appear in the same position. */
  it("handles error subclasses", () => {
    expect(
      strip("Error invoking remote method 'auth:begin': TypeError: nope"),
    ).toBe("nope");
  });

  /** A handler can reject with a plain string rather than an Error. */
  it("handles a bare rejection with no error name", () => {
    expect(
      strip("Error invoking remote method 'cloud:status': plain text"),
    ).toBe("plain text");
  });

  /** Multi-line messages must survive intact, hence the `s` flag. */
  it("keeps every line of a multi-line message", () => {
    expect(
      strip("Error invoking remote method 'x:y': Error: line one\nline two"),
    ).toBe("line one\nline two");
  });

  /** Anything not matching the wrapper is passed through untouched. */
  it("leaves an unwrapped message alone", () => {
    expect(strip("Could not reach the instance.")).toBe(
      "Could not reach the instance.",
    );
  });
});
