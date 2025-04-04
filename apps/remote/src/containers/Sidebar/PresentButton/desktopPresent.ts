import { core } from "@tauri-apps/api";

export const onPresentClick = async (
  orgSlug: string,
  projectSlug: string,
  monitorIndex: number = 0,
) => {
  await core.invoke("open_renderer", {
    url: window.location.origin + `/render/${orgSlug}/${projectSlug}`,
    monitorIndex,
  });
};
