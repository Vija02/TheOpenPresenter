import useSize from "@react-hook/size";
import React, { useMemo, useRef } from "react";

import { deriveAbbreviation } from "../../src/helpers/abbreviation";
import { getSlideVerses } from "../../src/helpers/slides";
import { getBibleStyle } from "../../src/style/style";
import { BiblePassage, BibleSlideStyle } from "../../src/types";
import { useFitText } from "./useFitText";

type VerseViewProps = {
  passage: BiblePassage;
  slideIndex: number;
  style?: BibleSlideStyle | null;
};

const LINE_HEIGHT = 1.15;

const VerseView = React.memo(
  ({ passage, slideIndex, style }: VerseViewProps) => {
    const target = useRef<any>(null);
    const [width, height] = useSize(target);

    const slideStyle = useMemo(() => getBibleStyle(style), [style]);
    const verses = useMemo(
      () => getSlideVerses(passage, slideIndex),
      [passage, slideIndex],
    );

    // Padding + reference caption reserve space; the rest is the bounding box.
    const padX = width * 0.06;
    const padY = height * 0.06;
    const refFontSize = slideStyle.showReference
      ? Math.max(10, width * 0.028)
      : 0;
    const refReserve = slideStyle.showReference
      ? refFontSize * 1.4 + width * 0.02
      : 0;

    const boxWidth = Math.max(0, width - padX * 2);
    const boxHeight = Math.max(0, height - padY * 2 - refReserve);

    // Fit against the whole slide's text (all grouped verses joined).
    const measureText = useMemo(
      () =>
        verses
          .map(
            (v) =>
              `${slideStyle.showVerseNumbers ? `${v.verse} ` : ""}${v.text}`,
          )
          .join(" "),
      [verses, slideStyle.showVerseNumbers],
    );

    const fittedFontSize = useFitText({
      text: measureText,
      width: boxWidth,
      height: boxHeight,
      fontFamily: slideStyle.fontFamily,
      fontWeight: slideStyle.fontWeight,
      lineHeight: LINE_HEIGHT,
    });

    const shadowBlur1 = fittedFontSize * 0.05;
    const shadowBlur2 = fittedFontSize * 0.1;

    // Caption reference: collapse a grouped slide into a range, e.g.
    // "John 3:16-17" (or "John 3:16-4:2" when it crosses a chapter).
    const reference = useMemo(() => {
      if (verses.length === 0) return passage.reference;
      const first = verses[0]!;
      const last = verses[verses.length - 1]!;
      if (verses.length === 1) {
        return `${first.bookName} ${first.chapter}:${first.verse}`;
      }
      return first.chapter === last.chapter
        ? `${first.bookName} ${first.chapter}:${first.verse}-${last.verse}`
        : `${first.bookName} ${first.chapter}:${first.verse}-${last.chapter}:${last.verse}`;
    }, [verses, passage.reference]);

    return (
      <div
        ref={target}
        className="relative h-full w-full overflow-hidden"
        style={{
          backgroundColor: slideStyle.backgroundColor,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: `${padY}px ${padX}px`,
          gap: `${width * 0.02}px`,
        }}
      >
        {verses.length > 0 ? (
          <>
            <div
              style={{
                width: "100%",
                textAlign: slideStyle.textAlign,
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                fontFamily: slideStyle.fontFamily,
                fontWeight: slideStyle.fontWeight,
                fontSize: `${fittedFontSize}px`,
                lineHeight: LINE_HEIGHT,
                color: slideStyle.textColor,
                textShadow: slideStyle.textShadow
                  ? `0 0 ${shadowBlur1}px rgba(0,0,0,0.9), 0 0 ${shadowBlur2}px rgba(0,0,0,0.6)`
                  : undefined,
              }}
            >
              {verses.map((v, idx) => (
                <React.Fragment key={`${v.chapter}:${v.verse}`}>
                  {idx > 0 ? " " : ""}
                  {slideStyle.showVerseNumbers && (
                    <sup
                      style={{
                        fontSize: "0.6em",
                        opacity: 0.7,
                        marginRight: "0.25em",
                        fontWeight: 400,
                      }}
                    >
                      {v.verse}
                    </sup>
                  )}
                  {v.text}
                </React.Fragment>
              ))}
            </div>

            {slideStyle.showReference && (
              <div
                style={{
                  width: "100%",
                  textAlign: "center",
                  fontFamily: slideStyle.fontFamily,
                  fontWeight: 400,
                  fontSize: `${refFontSize}px`,
                  color: slideStyle.textColor,
                  opacity: 0.85,
                  textShadow: slideStyle.textShadow
                    ? `0 0 ${shadowBlur1}px rgba(0,0,0,0.9)`
                    : undefined,
                }}
              >
                {reference} (
                {passage.translationAbbreviation ||
                  deriveAbbreviation(passage.translationName)}
                )
              </div>
            )}
          </>
        ) : null}
      </div>
    );
  },
);

export default VerseView;
