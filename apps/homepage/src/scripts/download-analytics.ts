declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

document.addEventListener("click", (e) => {
  const link = (e.target as HTMLElement).closest<HTMLElement>("[data-download]");
  if (!link) return;

  const app = link.dataset.download ?? "";
  const platform = link.dataset.platform ?? "";
  const variant = link.dataset.variant ?? "";
  const href = link.getAttribute("href") ?? "";

  window.gtag?.("event", "download", {
    app,
    platform,
    variant,
    label: [app, platform, variant].filter(Boolean).join(" / "),
    link_url: href,
  });
});

export {};
