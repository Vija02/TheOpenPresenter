export const onPresentClick = async (orgSlug: string, projectSlug: string) => {
  if (window.__TAURI_INTERNALS__) {
    await window.__TAURI_INTERNALS__.invoke("open_renderer", {
      url: window.location.origin + `/render/${orgSlug}/${projectSlug}`,
    });
  }
};
