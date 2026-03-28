import { core } from "@tauri-apps/api";

export const onPresentClick = async (
  orgSlug: string,
  projectSlug: string,
  monitorIndex: number = 0,
  search?: string,
  rendererId: string = "1",
) => {
  const basePath = `/render/${orgSlug}/${projectSlug}`;
  const rendererParam = `renderer=${rendererId}`;
  const fullPath = search
    ? `${basePath}?${search}&${rendererParam}`
    : `${basePath}?${rendererParam}`;

  await core.invoke("open_renderer", {
    url: window.location.origin + fullPath,
    mindex: monitorIndex,
  });
};
