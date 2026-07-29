import { LayoutRenderer } from "@repo/layout/react";
import React, { useMemo } from "react";

import {
  bibleBackground,
  bibleDocFromStyle,
} from "../../src/template/fromStyle";
import { passageToFrame } from "../../src/template/toFrame";
import { BiblePassage, BibleSlideStyle } from "../../src/types";

type VerseViewProps = {
  passage: BiblePassage;
  slideIndex: number;
  style?: BibleSlideStyle | null;
};

const VerseView = React.memo(
  ({ passage, slideIndex, style }: VerseViewProps) => {
    const doc = useMemo(() => bibleDocFromStyle(style), [style]);
    const data = useMemo(
      () => passageToFrame(passage, slideIndex, style),
      [passage, slideIndex, style],
    );

    return (
      <LayoutRenderer
        doc={doc}
        data={data}
        background={bibleBackground(style)}
      />
    );
  },
);

export default VerseView;
