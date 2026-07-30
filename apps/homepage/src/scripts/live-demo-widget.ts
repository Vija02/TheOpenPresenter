// Open/close behaviour for the floating live-demo widget.
//
// The widget starts collapsed as a bubble. Pages can opt into auto-expanding
// once the visitor has scrolled a little, via `openOnScroll`. Once someone
// closes it by hand we stop auto-opening — reopening something a user just
// dismissed is the fastest way to make it feel like an ad.
//
// Visibility is driven by inline style rather than a `hidden` class so we
// don't depend on Tailwind utility ordering to win the cascade.

/** Start-state utilities the CSS transition animates away from. */
const HIDDEN = ["opacity-0", "translate-y-3", "scale-95"];

const OPEN_AT = () => Math.min(400, window.innerHeight * 0.5);

function hide(el: HTMLElement) {
  el.style.display = "none";
  el.classList.add(...HIDDEN);
}

function show(el: HTMLElement, display: string) {
  el.style.display = display;
  // Force a style flush so the browser records the hidden start state before
  // we remove it. Without this the display change and the class removal land
  // in the same recalc and the element simply pops in.
  void el.offsetHeight;
  el.classList.remove(...HIDDEN);
}

function initWidgets() {
  document
    .querySelectorAll<HTMLElement>("[data-live-demo-widget]")
    .forEach((widget) => {
      const panel = widget.querySelector<HTMLElement>("[data-widget-panel]");
      const bubble = widget.querySelector<HTMLElement>("[data-widget-bubble]");
      const close =
        widget.querySelector<HTMLButtonElement>("[data-widget-close]");

      if (!panel || !bubble) return;

      const openOnScroll = widget.dataset.widgetOpenOnScroll === "true";

      let open = false;
      let dismissed = false;

      const render = () => {
        if (open) {
          hide(bubble);
          show(panel, "block");
        } else {
          hide(panel);
          show(bubble, "flex");
        }
        bubble.setAttribute("aria-expanded", open ? "true" : "false");
      };

      close?.addEventListener("click", () => {
        open = false;
        dismissed = true;
        render();
      });

      bubble.addEventListener("click", () => {
        open = true;
        render();
      });

      if (openOnScroll) {
        const onScroll = () => {
          if (open || dismissed) return;
          if (window.scrollY < OPEN_AT()) return;
          window.removeEventListener("scroll", onScroll);
          open = true;
          render();
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
      }

      // Collapsed is the initial state; render it without animating in.
      bubble.classList.remove(...HIDDEN);
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWidgets, { once: true });
} else {
  initWidgets();
}
