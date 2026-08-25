import type { LayoutDoc } from "@repo/layout";
import { LayoutRenderer } from "@repo/layout/react";
import React, { useMemo } from "react";

import { resolveBibleDoc } from "../../src/template/presets";
import { passageToFrame } from "../../src/template/toFrame";
import { BiblePassage } from "../../src/types";
import { verseScope } from "../../src/verseActivation";

type VerseViewProps = {
  passage: BiblePassage;
  slideIndex: number;
  template?: LayoutDoc | null;
  showVerseNumbers?: boolean;
  activeSince?: number | null;
};

const VerseView = React.memo(
  ({
    passage,
    slideIndex,
    template,
    showVerseNumbers,
    activeSince = null,
  }: VerseViewProps) => {
    const doc = useMemo(() => resolveBibleDoc(template), [template]);
    const data = useMemo(
      () => passageToFrame(passage, slideIndex, { showVerseNumbers }),
      [passage, slideIndex, showVerseNumbers],
    );

    return (
      <LayoutRenderer
        doc={doc}
        data={data}
        activeSince={activeSince}
        scope={verseScope(passage.id, slideIndex)}
      />
    );
  },
);

export default VerseView;
