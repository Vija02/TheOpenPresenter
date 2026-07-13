function closeOpenDetails(except?: Node | null): void {
  // Only auto-close dropdowns explicitly opted in via data-autoclose (e.g. the
  // Linux download menu). The download accordions are also <details> but must
  // stay open when the user clicks elsewhere.
  document
    .querySelectorAll<HTMLDetailsElement>("details[data-autoclose][open]")
    .forEach((d) => {
      if (except && d.contains(except)) return;
      d.removeAttribute("open");
    });
}

document.addEventListener("click", (e) => {
  closeOpenDetails(e.target as Node | null);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeOpenDetails();
});
