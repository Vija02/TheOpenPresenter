import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createHostElement } from "../../../schema/defaults";
import { LayoutHostCatalogProvider } from "../../context/hostCatalog";
import { HostElementFrame } from "../HostElementFrame";

/**
 * The framed renderer paints its own output black, but here it is a fragment
 * composited into someone else's layout, so empty content must read as empty
 * rather than as a black box over whatever sits beneath it.
 */
const element = createHostElement({
  id: "host-1",
  source: { kind: "screen", rendererId: "2" },
});

describe("HostElementFrame", () => {
  it("frames the live preview with a transparent background", () => {
    const { container } = render(
      <LayoutHostCatalogProvider
        catalog={{ sources: [], previewUrl: () => "https://example.test/x" }}
      >
        <HostElementFrame element={element} />
      </LayoutHostCatalogProvider>,
    );

    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.style.background).toBe("transparent");
  });

  it("shows the placeholder and no iframe when no preview URL is supplied", () => {
    const { container } = render(<HostElementFrame element={element} />);

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain("Screen 2");
  });
});
