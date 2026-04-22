// Find out what it resolves to
// Useful for calculating it when we need to convert to dumb image slides
export const calculateResolvedSlideIndex = ({
  slideIndex,
  clickCount,
  slideCount,
  slideClickCounts,
}: {
  slideIndex: number | null;
  clickCount: number | null;
  slideCount: number;
  slideClickCounts?: number[];
}): number => {
  const baseIndex = slideIndex ?? 0;
  const clicks = clickCount ?? 0;

  // If no slideClickCounts provided or empty, use simple calculation
  if (!slideClickCounts || slideClickCounts.length === 0) {
    return Math.min(slideCount - 1, Math.max(0, baseIndex + clicks));
  }

  let remainingClicks = clicks;
  let currentSlide = baseIndex;

  if (remainingClicks >= 0) {
    // Moving forward
    while (remainingClicks > 0 && currentSlide < slideClickCounts.length) {
      const clicksForCurrentSlide = slideClickCounts[currentSlide] ?? 0;

      if (remainingClicks > clicksForCurrentSlide) {
        // Move to next slide
        remainingClicks -= clicksForCurrentSlide + 1; // +1 for the slide transition
        currentSlide++;
      } else {
        // Stay on current slide (still within animations)
        break;
      }
    }
  } else {
    // Moving backward
    while (remainingClicks < 0 && currentSlide >= 0) {
      if (currentSlide > 0) {
        const clicksForPrevSlide = slideClickCounts[currentSlide - 1] ?? 0;
        // Move to previous slide
        remainingClicks += clicksForPrevSlide + 1; // +1 for the slide transition
        currentSlide--;
      } else {
        break;
      }
    }
  }

  // Clamp to valid range
  return Math.min(slideClickCounts.length - 1, Math.max(0, currentSlide));
};
