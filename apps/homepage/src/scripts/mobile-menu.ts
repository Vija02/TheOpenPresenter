// Toggles the mobile nav dropdown.
function initMobileMenu() {
  const toggle = document.getElementById("mobile-menu-toggle");
  const panel = document.getElementById("mobile-menu-panel");
  if (!toggle || !panel) return;

  const isOpen = () => !panel.classList.contains("hidden");

  const setOpen = (open: boolean) => {
    panel.classList.toggle("hidden", !open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  toggle.addEventListener("click", () => setOpen(!isOpen()));

  const onOutside = (e: Event) => {
    if (!isOpen()) return;
    const target = e.target as Node | null;
    if (target && (panel.contains(target) || toggle.contains(target))) return;
    setOpen(false);
  };
  document.addEventListener("pointerdown", onOutside);
  document.addEventListener("click", onOutside);

  // Close on Escape for keyboard users.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMobileMenu, { once: true });
} else {
  initMobileMenu();
}
