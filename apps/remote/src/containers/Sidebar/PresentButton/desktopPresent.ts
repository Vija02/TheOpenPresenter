import { core } from "@tauri-apps/api";

export const onPresentClick = async (
  orgSlug: string,
  projectSlug: string,
  monitorIndex: number = 0,
  search?: string,
) => {
  const basePath = `/render/${orgSlug}/${projectSlug}`;
  const fullPath = search ? `${basePath}?${search}` : basePath;

  await core.invoke("open_renderer", {
    url: window.location.origin + fullPath,
    mindex: monitorIndex,
  });
};
