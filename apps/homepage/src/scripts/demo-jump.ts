function initDemoJump() {
  document
    .querySelectorAll<HTMLAnchorElement>("[data-init-demo-jump]")
    .forEach((el) => {
      el.addEventListener("click", (e) => {
        if (window.location.pathname !== "/") {
          // Let the browser navigate to the home page.
          el.setAttribute("href", "/");
          return;
        }
        e.preventDefault();
        document
          .querySelector("section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDemoJump, { once: true });
} else {
  initDemoJump();
}
