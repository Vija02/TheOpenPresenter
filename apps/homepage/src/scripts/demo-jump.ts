// Wires up [data-init-demo-jump] buttons. Three cases, in order:
//   1. The page has an inline QR (the hero) — scroll to it.
//   2. The page only has the floating widget — open it. Scrolling to it would
//      be a no-op, since a collapsed widget is display:none.
//   3. Neither — send the visitor to the one on the home page.
const HOME_DEMO_URL = "/#demo";

function initDemoJump() {
  const roots = Array.from(
    document.querySelectorAll<HTMLElement>("[data-live-demo-role='root']"),
  );
  const inline = roots.find((r) => !r.closest("[data-live-demo-widget]"));
  const bubble = document.querySelector<HTMLElement>(
    "[data-live-demo-widget] [data-widget-bubble]",
  );

  const anchorId = inline?.closest("[id]")?.id;

  document
    .querySelectorAll<HTMLAnchorElement>("[data-init-demo-jump]")
    .forEach((el) => {
      // Set a real href so the control still works without JS, and so it
      // reads as a link on hover.
      if (inline) {
        el.setAttribute("href", anchorId ? `#${anchorId}` : "#");
      } else if (bubble) {
        el.setAttribute("href", "#");
      } else {
        el.setAttribute("href", HOME_DEMO_URL);
      }

      el.addEventListener("click", (e) => {
        if (inline) {
          e.preventDefault();
          inline.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (bubble) {
          e.preventDefault();
          bubble.click();
        }
        // Otherwise let the browser navigate to the home page.
      });
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDemoJump, { once: true });
} else {
  initDemoJump();
}
