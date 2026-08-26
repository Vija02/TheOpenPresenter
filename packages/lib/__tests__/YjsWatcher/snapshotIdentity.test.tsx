import { render } from "@testing-library/react";
import { act } from "react";
import { describe, expect, test } from "vitest";
import * as Y from "yjs";

import { YjsWatcher } from "../../src";

/**
 * Snapshot identity, which `useSyncExternalStore` re-renders on.
 *
 * A snapshot that returns an equal-but-NEW object on every read renders
 * forever (React error #185, "Maximum update depth exceeded"). Y types are
 * converted with `toJSON` and were always cached, but a PLAIN object is stored
 * by Yjs verbatim — `map.set(key, {...})` keeps it as a raw value — and the
 * traverser's `unwrap` rebuilds it per read, so it needs the same cache.
 *
 * Not hypothetical: the slides key-press handler writes `_layoutVideoStates`
 * as a plain object through a raw Y.Map, and every video fill reads it with
 * `renderer.useData`. Without the cache, one arrow key press put the renderer
 * into an infinite render loop that unmounted every <video>.
 *
 * These render the hook for real. Asserting on a hand-rolled copy of the
 * caching branch would pass with the cache deleted from the source.
 */
describe("YjsWatcher snapshot identity", () => {
  /** Renders `useYjsData` and reports how many times it rendered. */
  const renderHook = (map: Y.Map<any>, fn: (x: any) => unknown) => {
    const watcher = new YjsWatcher(map);
    let renders = 0;
    let last: unknown;

    const Probe = () => {
      renders += 1;
      last = watcher.useYjsData(fn);
      return null;
    };

    const view = render(<Probe />);
    return {
      get renders() {
        return renders;
      },
      get value() {
        return last;
      },
      rerender: () => view.rerender(<Probe />),
      cleanup: () => {
        view.unmount();
        watcher.dispose();
      },
    };
  };

  test("a Y.Map value settles rather than re-rendering forever", () => {
    const doc = new Y.Doc();
    const map = doc.getMap<any>("map");
    const child = new Y.Map();
    child.set("a", 1);
    map.set("state", child);

    const probe = renderHook(map, (x) => x.state);
    expect(probe.value).toEqual({ a: 1 });
    probe.cleanup();
  });

  test("a plain-object value settles too", () => {
    const doc = new Y.Doc();
    const map = doc.getMap<any>("map");
    // Exactly the shape `yjsVideoStateTarget.setVideoStates` writes.
    map.set("state", { key: { uid: "1", isPlaying: true } });

    // Rendering at all is the assertion: with the identity cache missing,
    // React throws "Maximum update depth exceeded" from inside render.
    const probe = renderHook(map, (x) => x.state);
    expect(probe.value).toEqual({ key: { uid: "1", isPlaying: true } });

    // A re-render with the store untouched must not produce a new snapshot,
    // which is what the infinite loop was made of.
    const before = probe.value;
    probe.rerender();
    expect(probe.value).toBe(before);

    probe.cleanup();
  });

  test("a genuine change still reaches the component", () => {
    const doc = new Y.Doc();
    const map = doc.getMap<any>("map");
    map.set("state", { key: { uid: "1" } });

    const probe = renderHook(map, (x) => x.state);
    expect(probe.value).toEqual({ key: { uid: "1" } });

    // Caching must not mask a real update, or the video would never re-seek.
    act(() => {
      map.set("state", { key: { uid: "2" } });
    });
    expect(probe.value).toEqual({ key: { uid: "2" } });

    probe.cleanup();
  });
});
