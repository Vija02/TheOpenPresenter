import { useMemo } from "react";

import { SlideStyle } from "../../src/types";

export const usePadding = (
  slideStyle: Required<SlideStyle>,
  { width, height }: { width: number; height: number },
) => {
  const padding = useMemo(() => {
    if (slideStyle.paddingIsLinked) {
      const scaledPadding = (slideStyle.padding / 100) * width;
      const clamppedPadding = Math.min(width / 2, height / 2, scaledPadding);

      return [
        clamppedPadding,
        clamppedPadding,
        clamppedPadding,
        clamppedPadding,
      ] as [number, number, number, number];
    } else {
      /* 
        top | right | bottom | left
        Matching CSS order
      */
      return [
        slideStyle.topPadding,
        slideStyle.rightPadding,
        slideStyle.bottomPadding,
        slideStyle.leftPadding,
      ].map((x) => (x / 100) * width) as [number, number, number, number];
    }
  }, [
    height,
    slideStyle.bottomPadding,
    slideStyle.leftPadding,
    slideStyle.padding,
    slideStyle.paddingIsLinked,
    slideStyle.rightPadding,
    slideStyle.topPadding,
    width,
  ]);

  return padding;
};
