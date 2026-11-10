import { ServerPluginApi } from "@repo/base-plugin/server";

import { chordProToOpenSong } from "../chords/convert/chordProToOpenSong";
import {
  collectChordLyricPairs,
  openSongToChordPro,
} from "../chords/convert/openSongToChordPro";
import { contentHasChordPro } from "../chords/song";

export type FormatLyricsOptions = {
  linesPerSlide?: number;
  instructions?: string;
  maxCharsPerLine?: number;
  signal?: AbortSignal;
};

/**
 * Builds the system prompt for the lyric-formatting model.
 *
 * Contract the rest of the code relies on:
 *   - INPUT  : raw lyrics text, lines separated by "\n".
 *   - OUTPUT : reformatted lyrics text, lines separated by "\n".
 *              Sections are separated by a single blank line; slides WITHIN a
 *              section are separated by a lone "-" line. Lyrics only, no
 *              commentary.
 *
 * Domain rules encoded below: bracket section headings, split section bodies
 * into <= linesPerSlide lyric lines per slide, keep inline ChordPro chords on
 * their syllable, treat "." chord lines as transparent, and never alter the
 * words themselves.
 */
const buildSystemPrompt = (
  linesPerSlide: number,
  maxCharsPerLine: number,
): string =>
  `
You prepare church song lyrics for projection on a screen. You have TWO jobs:
(1) break long lyric lines into short display lines, and (2) group those lines
into slides. Re-break lines and re-group them as needed. The ONLY thing you must
never do is add, remove, reorder, translate, or rephrase a word — you change
WHERE lines break and WHERE slides break, nothing about the words themselves.

INPUT
- Lyrics are split into sections. Each section begins with a heading such as
  "Verse 1", "Chorus", "Pre-Chorus", or "Bridge", either bare ("Verse 1") or
  already wrapped in square brackets ("[Verse 1]"). A heading is always alone on
  its line.
- Lyrics may carry CHORDS, in two ways:
  - INLINE (ChordPro): a chord in square brackets placed right before the
    syllable it is played on, e.g. "Amazing [G]grace how [C]sweet the [G]sound".
    A bracket inside a lyric line is ALWAYS a chord, never a heading.
  - CHORD LINE: a line whose FIRST character is a dot (".") holds only chords
    (e.g. ".G    C    D", or ".| G /// | Em / D / |" for an instrumental). When
    a lyric line sits directly beneath it, the chords belong to that line.
- A line that is only a single dash ("-") is an existing SLIDE BREAK.

TASK — perform these steps IN ORDER
1. Headings: wrap every section heading in square brackets. Convert a bare
   "Verse 1" to "[Verse 1]"; leave already-bracketed headings unchanged. Never
   invent a heading that is not present.
     - NEVER remove an existing heading
     - NEVER put a chord on a heading line, and never turn a chord into one
2. BREAK LONG LINES — this is the most important step and is REQUIRED, not
   optional. Every lyric line in your output MUST be ${maxCharsPerLine}
   characters or fewer, counting the words only: inline [chords] do not count.
   For any lyric line longer than ${maxCharsPerLine} characters, split it into
   two or more lines:
     - Prefer to split at a comma.
     - Otherwise split between natural phrases, or before a conjunction
       (and, but, for, that, where, when, ...).
     - Keep splitting until EVERY resulting line is ${maxCharsPerLine}
       characters or fewer.
   You may capitalize the first letter of a line you create. This step changes
   line breaks ONLY, never the words.
3. Group into slides by the song's NATURAL phrasing, AFTER long lines are broken.
   ${linesPerSlide} is a hard MAXIMUM per slide, NOT a target — never fill a slide
   to the cap just because there is room.
   - Follow the song's own phrase units and keep complete thoughts together:
     never split a sentence or clause across a slide boundary. Two display lines
     that came from splitting ONE long line stay on the same slide.
   - Keep group sizes CONSISTENT within a section and avoid a lopsided remainder:
     prefer a balanced split (e.g. 2+2+2, or 3+3) over a lopsided one (4+2).
   - When more than one balanced grouping fits under the cap, pick the one that
     matches the phrasing; smaller even groups (often pairs) usually read better
     than a single packed slide.
   - Never let a slide exceed ${linesPerSlide} lyric lines.
   Insert a single "-" line between slides, and re-balance any existing "-" breaks
   the same way.
4. Counting: ONLY lyric lines count toward the ${linesPerSlide} limit. Chord
   lines (leading ".") and lines holding only inline chords (e.g. "[G] [C] [D]")
   do NOT count, and are never alone on a slide.
5. Chords — every chord in the input must be in the output, unchanged and in the
   same order:
   - Inline [chords]: keep each one exactly where it is, immediately before the
     same syllable. When you split a line, each chord goes with the word it
     sits on. Never drop, add, move, rename or re-space a chord.
   - Chord lines (leading "."): reproduce them exactly (same characters and
     spacing). Keep one immediately above its lyric line, and never place a
     slide break between the two. If you split the lyric line under a chord
     line, the chord line stays above the FIRST piece. A chord line with no
     lyric beneath it (an intro or instrumental) stays where it is.

OUTPUT
- Output ONLY the reformatted lyrics. No commentary, no explanation, no markdown
  fences.
- Separate sections with exactly one blank line.
- Separate slides within a section with a single "-" line. Do not start or end a
  section with a "-".

EXAMPLE (this example uses a 45-character line limit and 4 lyric lines per slide)
Input:
Verse
.| G /// | D /// |
[G]My Jesus, [D]My Savior, [Em]Lord there is [D]none like [C]you
All of my [G]days, [C]I want to [G]praise, the [Em]wonders of your [F]mighty [D]love
My comfort, My shelter, tower of refuge and strength
Let every breath, all that I am, never cease to worship you

[Chorus]
Shout to the Lord all the earth let us sing
Power and majesty praise to the king
Mountains bow down and the seas will roar at the sound of your name
I sing for joy at the work of your hands
Forever I'll love you forever I'll stand
Nothing compares to the promise I have in You

Output:
[Verse]
.| G /// | D /// |
[G]My Jesus, [D]My Savior
[Em]Lord there is [D]none like [C]you
All of my [G]days, [C]I want to [G]praise
The [Em]wonders of your [F]mighty [D]love
-
My comfort, My shelter
Tower of refuge and strength
Let every breath, all that I am
Never cease to worship you

[Chorus]
Shout to the Lord all the earth let us sing
Power and majesty praise to the king
Mountains bow down and the seas will roar
At the sound of your name
-
I sing for joy at the work of your hands
Forever I'll love you forever I'll stand
Nothing compares to the promise I have in You
`.trim();

const buildInstructions = (): string =>
  `

USER INSTRUCTIONS
The user's message may start with instructions of their own. They come first:
they override every rule above, including never adding or removing words or
chords. If they ask you to delete, add, move, repeat or rewrite something, do
it. Only these still hold: output lyrics only, headings in square brackets,
slides separated by "-", and on the lines you keep, each chord stays on its
syllable.`;

const buildUserPrompt = (content: string, instructions?: string): string =>
  instructions
    ? `My instructions (these come first):\n"""\n${instructions}\n"""\n\nReformat these lyrics following my instructions:\n\n${content}`
    : `Reformat these lyrics:\n\n${content}`;

// Use Chordpro for formatting since it'll be more reliable
const usesChordLines = (content: string): boolean =>
  !contentHasChordPro(content) &&
  collectChordLyricPairs(content.split("\n")).length > 0;

/** ChordPro text back into chord lines, a whole line at a time. */
export async function* toChordLines(
  deltas: AsyncIterable<string>,
): AsyncGenerator<string, void, unknown> {
  let pending = "";
  for await (const delta of deltas) {
    pending += delta;
    let end: number;
    while ((end = pending.indexOf("\n")) !== -1) {
      yield chordProToOpenSong(pending.slice(0, end)) + "\n";
      pending = pending.slice(end + 1);
    }
  }
  if (pending) yield chordProToOpenSong(pending);
}

export async function* formatLyricsStream(
  serverPluginApi: ServerPluginApi,
  content: string,
  options: FormatLyricsOptions = {},
): AsyncGenerator<string, void, unknown> {
  const trimmed = content.trim();
  if (!trimmed) return;

  const linesPerSlide = options.linesPerSlide ?? 4;
  const maxCharsPerLine = options.maxCharsPerLine ?? 45;
  const chordLines = usesChordLines(trimmed);

  const deltas = serverPluginApi.ai.chatCompletionStream(
    [
      {
        role: "system",
        content:
          buildSystemPrompt(linesPerSlide, maxCharsPerLine) +
          (options.instructions ? buildInstructions() : ""),
      },
      {
        role: "user",
        content: buildUserPrompt(
          chordLines ? openSongToChordPro(trimmed) : trimmed,
          options.instructions,
        ),
      },
    ],
    {
      model: "deepseek/deepseek-v4.1-flash:nitro",
      temperature: 0,
      reasoningEnabled: false,
      signal: options.signal,
    },
  );

  yield* chordLines ? toChordLines(deltas) : deltas;
}
