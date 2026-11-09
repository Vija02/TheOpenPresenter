/** One run of text between line breaks, or the break itself. */
export type LinePiece = { text: string; isLast: boolean } | "\n";

/**
 * Splits a styled span's text at its line breaks, so each break can sit
 * between spans rather than inside one. Firefox ignores the per-line
 * direction of `unicode-bidi: plaintext` for a line that starts inside a
 * span, so the second line of right-to-left text would sit on the left.
 *
 * Empty runs are dropped, so a span ending in a break leaves no empty span
 * (and no stray `marginAfter`) at the start of the next line. `isLast` marks
 * the run that ends the span, which is where `marginAfter` belongs, as on an
 * unsplit span. Shared by render and measure so both lay out the same.
 */
export const splitAtBreaks = (text: string): LinePiece[] => {
  const lines = text.split("\n");
  const pieces: LinePiece[] = [];
  lines.forEach((line, i) => {
    const isLast = i === lines.length - 1;
    if (line !== "") pieces.push({ text: line, isLast });
    if (!isLast) pieces.push("\n");
  });
  return pieces;
};
