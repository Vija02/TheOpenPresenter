import { type Monitor, desktop } from "@repo/desktop-bridge";
import { captureEvent } from "@repo/observability/initAnalytics";

export const onPresentClick = async (
  orgSlug: string,
  projectSlug: string,
  monitor: Pick<Monitor, "index" | "id"> = { index: 0 },
  search?: string,
  rendererId: string = "1",
) => {
  const basePath = `/render/${orgSlug}/${projectSlug}`;
  const rendererParam = `renderer=${rendererId}`;
  const fullPath = search
    ? `${basePath}?${search}&${rendererParam}`
    : `${basePath}?${rendererParam}`;

  await desktop.present(
    window.location.origin + fullPath,
    monitor.index,
    rendererId,
    monitor.id,
  );

  captureEvent("presented", {
    present_type: "desktop_monitor",
    monitor_index: monitor.index,
  });
};
