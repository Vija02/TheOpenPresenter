export const calculateMinClickCount = ({
  slideIndex,
  slideClickCounts,
}: {
  slideIndex: number | null;
  slideClickCounts: number[];
}): number => {
  const baseIndex = slideIndex ?? 0;

  // We can go back through all previous slides
  // Each slide requires (slideClickCounts[i] + 1) clicks to traverse
  let minClicks = 0;
  for (let i = 0; i < baseIndex && i < slideClickCounts.length; i++) {
    minClicks -= (slideClickCounts[i] ?? 0) + 1;
  }

  return minClicks;
};

export const calculateMaxClickCount = ({
  slideIndex,
  slideClickCounts,
}: {
  slideIndex: number | null;
  slideClickCounts: number[];
}): number => {
  const baseIndex = slideIndex ?? 0;

  // We can go forward through all remaining slides
  // Current slide: slideClickCounts[baseIndex] clicks for animations
  // Each subsequent slide: (slideClickCounts[i] + 1) clicks (1 for transition + animations)
  let maxClicks = 0;

  for (let i = baseIndex; i < slideClickCounts.length; i++) {
    if (i === baseIndex) {
      // Current slide: just the animations
      maxClicks += slideClickCounts[i] ?? 0;
    } else {
      // Subsequent slides: transition + animations
      maxClicks += (slideClickCounts[i] ?? 0) + 1;
    }
  }

  return maxClicks;
};

export const clampClickCount = ({
  clickCount,
  slideIndex,
  slideClickCounts,
}: {
  clickCount: number;
  slideIndex: number | null;
  slideClickCounts: number[];
}): number => {
  const minClickCount = calculateMinClickCount({
    slideIndex,
    slideClickCounts,
  });
  const maxClickCount = calculateMaxClickCount({
    slideIndex,
    slideClickCounts,
  });

  return Math.min(maxClickCount, Math.max(minClickCount, clickCount));
};
