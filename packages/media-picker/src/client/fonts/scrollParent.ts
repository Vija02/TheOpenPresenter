// For `IntersectionObserver` roots: with the viewport as root, `rootMargin`
// can't reach past a scrolling panel, so nothing would load ahead of time
export const scrollParentOf = (el: Element): Element | null => {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === "auto" || overflowY === "scroll") return p;
  }
  return null;
};
