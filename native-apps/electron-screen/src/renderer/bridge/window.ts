export const getWindowLabel = (): string =>
  new URLSearchParams(window.location.search).get("window") ?? "main";
