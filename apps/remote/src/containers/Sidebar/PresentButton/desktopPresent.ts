import { type Monitor, desktop, displayKey } from "@repo/desktop-bridge";
import { captureEvent } from "@repo/observability/initAnalytics";

import { presentedOnStore } from "./presentedOn";
import { buildRenderPath } from "./renderUrl";

export const onPresentClick = async (
  orgSlug: string,
  projectSlug: string,
  monitor: Pick<Monitor, "index" | "id" | "name" | "x" | "y"> = {
    index: 0,
    name: "",
    x: 0,
    y: 0,
  },
  search: string = "",
  rendererId: string = "1",
) => {
  const path = buildRenderPath(orgSlug, projectSlug, search, rendererId);

  await desktop.present(
    window.location.origin + path,
    monitor.index,
    rendererId,
    monitor.id,
  );
  if (monitor.name) {
    presentedOnStore
      .getState()
      .set(rendererId, monitor.name, displayKey(monitor));
  }

  captureEvent("presented", {
    present_type: desktop.isDesktop ? "desktop_monitor" : "web_monitor",
    monitor_index: monitor.index,
  });
};
