// Wires up [data-init-demo-jump] buttons. If the current page carries a live
// demo, scroll to it; otherwise send the visitor to the one on the home page.
const HOME_DEMO_URL = "/#demo";

function initDemoJump() {
  document
    .querySelectorAll<HTMLAnchorElement>("[data-init-demo-jump]")
    .forEach((el) => {
      const demo = document.querySelector("[data-live-demo-role='root']");
      const anchorId = demo?.closest("[id]")?.id;

      // Set a real href so the control still works without JS, and so it
      // reads as a link on hover.
      el.setAttribute(
        "href",
        demo ? (anchorId ? `#${anchorId}` : "#") : HOME_DEMO_URL,
      );

      el.addEventListener("click", (e) => {
        if (!demo) return; // let the browser navigate to the home page
        e.preventDefault();
        demo.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDemoJump, { once: true });
} else {
  initDemoJump();
}
