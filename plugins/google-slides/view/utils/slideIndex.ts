// Only for image renderer
export const calculateBaseSlideIndex = ({
  slideIndex,
  clickCount,
  slideCount,
}: {
  slideIndex: number | null;
  clickCount: number | null;
  slideCount: number;
}) => {
  return Math.min(
    slideCount - 1,
    Math.max(0, (slideIndex ?? 0) + (clickCount ?? 0)),
  );
};
