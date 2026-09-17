import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StageMetrics } from "../../../geometry/scale";
import { createHostElement } from "../../../schema/defaults";
import { HostElementView } from "../HostElement";

/**
 * The inner content layer's `z-index: 1` must stay confined to the host
 * element, or it competes with siblings and paints over whatever the author
 * layered above it.
 *
 * Rendered directly rather than through LayoutRenderer: Stage withholds its
 * children until it measures a non-zero box, which never happens in jsdom.
 */
const METRICS: StageMetrics = {
  containerWidth: 1920,
  containerHeight: 1080,
  boxWidth: 1920,
  boxHeight: 1080,
  offsetX: 0,
  offsetY: 0,
  unit: 19.2,
};

const element = createHostElement({
  id: "host-1",
  source: { kind: "screen", rendererId: "2" },
  rect: { x: 0, y: 0, w: 50, h: 50 },
});

describe("host element stacking", () => {
  it("isolates its content layer so it cannot escape the element", () => {
    const { container } = render(
      <HostElementView element={element} metrics={METRICS} />,
    );

    const host = container.querySelector("[data-lay-host]") as HTMLElement;
    expect(host).toBeTruthy();

    // Without this the inner z-index:1 escapes into the stage's stacking
    // context and outranks every later sibling.
    expect(host.style.isolation).toBe("isolate");
  });

  it("keeps the content layer above the element's own fill", () => {
    const { container } = render(
      <HostElementView element={element} metrics={METRICS} />,
    );

    const host = container.querySelector("[data-lay-host]") as HTMLElement;
    const contentLayer = host.querySelector(
      ":scope > div[style*='z-index']",
    ) as HTMLElement;

    expect(contentLayer).toBeTruthy();
    expect(contentLayer.style.zIndex).toBe("1");
  });
});
