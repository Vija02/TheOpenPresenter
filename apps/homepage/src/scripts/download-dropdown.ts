function closeOpenDetails(except?: Node | null): void {
  document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((d) => {
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
