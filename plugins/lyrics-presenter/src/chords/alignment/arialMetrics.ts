/**
 * Arial width used to position chords for MWL source.
 * These are unkerned advances but it shouldn't affect most songs.
 */
export const ARIAL_WIDTHS: Record<string, number> = {
  " ": 278,
  "!": 278,
  '"': 355,
  "#": 556,
  $: 556,
  "%": 889,
  "&": 667,
  "'": 191,
  "(": 333,
  ")": 333,
  "*": 389,
  "+": 584,
  ",": 278,
  "-": 333,
  ".": 278,
  "/": 278,
  "0": 556,
  "1": 556,
  "2": 556,
  "3": 556,
  "4": 556,
  "5": 556,
  "6": 556,
  "7": 556,
  "8": 556,
  "9": 556,
  ":": 278,
  ";": 278,
  "<": 584,
  "=": 584,
  ">": 584,
  "?": 556,
  "@": 1015,
  A: 667,
  B: 667,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 500,
  K: 667,
  L: 556,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,
  "[": 278,
  "\\": 278,
  "]": 278,
  "^": 469,
  _: 556,
  "`": 333,
  a: 556,
  b: 556,
  c: 500,
  d: 556,
  e: 556,
  f: 278,
  g: 556,
  h: 556,
  i: 222,
  j: 222,
  k: 500,
  l: 222,
  m: 833,
  n: 556,
  o: 556,
  p: 556,
  q: 556,
  r: 333,
  s: 500,
  t: 278,
  u: 556,
  v: 500,
  w: 722,
  x: 500,
  y: 500,
  z: 500,
  "{": 334,
  "|": 260,
  "}": 334,
  "~": 584,
  "\u2018": 222,
  "\u2019": 222,
  "\u201c": 333,
  "\u201d": 333,
  "\u2013": 556,
  "\u2014": 1000,
  "\u2026": 1000,
  "\u00a0": 278,
};

/** Width used for anything outside the table (accented letters, CJK, ...). */
const FALLBACK_WIDTH = ARIAL_WIDTHS.n!;

export const arialCharWidth = (char: string): number =>
  ARIAL_WIDTHS[char] ?? FALLBACK_WIDTH;

export const arialWidth = (text: string): number => {
  let total = 0;
  for (const char of text) total += arialCharWidth(char);
  return total;
};

/**
 * Index into `text` whose left edge sits closest to `width` (in 1/1000 em)
 * when `text` is set in Arial.
 */
export const arialIndexAtWidth = (text: string, width: number): number => {
  let accumulated = 0;
  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let i = 0; i <= text.length; i++) {
    const distance = Math.abs(accumulated - width);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
    if (i < text.length) accumulated += arialCharWidth(text[i]!);
  }

  return bestIndex;
};
