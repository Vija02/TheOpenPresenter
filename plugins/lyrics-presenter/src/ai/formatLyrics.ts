import { ServerPluginApi } from "@repo/base-plugin/server";

export type FormatLyricsOptions = {
  linesPerSlide?: number;
  maxCharsPerLine?: number;
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
 * into <= linesPerSlide lyric lines per slide, treat ".chord" lines as
 * transparent, and never alter the words themselves.
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
  already wrapped in square brackets ("[Verse 1]").
- A line whose FIRST character is a dot (".") is a CHORD line (e.g.
  ".G    C    D"). Only the leading dot marks the line as chords; the chords
  after it are plain text with NO dots. It sits directly above the lyric line it
  applies to.
- A line that is only a single dash ("-") is an existing SLIDE BREAK.

TASK — perform these steps IN ORDER
1. Headings: wrap every section heading in square brackets. Convert a bare
   "Verse 1" to "[Verse 1]"; leave already-bracketed headings unchanged. Never
   invent a heading that is not present.
     - NEVER remove an existing heading
2. BREAK LONG LINES — this is the most important step and is REQUIRED, not
   optional. Every lyric line in your output MUST be ${maxCharsPerLine}
   characters or fewer. For any lyric line longer than ${maxCharsPerLine}
   characters, split it into two or more lines:
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
   lines (leading ".") do NOT count and are never alone on a slide.
5. Chords: reproduce every chord line exactly (same characters and spacing) and
   keep it immediately above its lyric line. Never place a slide break between a
   chord line and the lyric line beneath it. If you split the lyric line under a
   chord line, the chord line stays above the FIRST piece.

OUTPUT
- Output ONLY the reformatted lyrics. No commentary, no explanation, no markdown
  fences.
- Separate sections with exactly one blank line.
- Separate slides within a section with a single "-" line. Do not start or end a
  section with a "-".

EXAMPLE (this example uses a 45-character line limit and 4 lyric lines per slide)
Input:
Verse
.G        D         Em
My Jesus, My Savior, Lord there is none like you
All of my days, I want to praise, the wonders of your mighty love
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
.G        D         Em
My Jesus, My Savior
Lord there is none like you
All of my days, I want to praise
The wonders of your mighty love
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

const buildUserPrompt = (content: string): string =>
  `Reformat these lyrics:\n\n${content}`;

export async function* formatLyricsStream(
  serverPluginApi: ServerPluginApi,
  content: string,
  options: FormatLyricsOptions = {},
): AsyncGenerator<string, void, unknown> {
  const trimmed = content.trim();
  if (!trimmed) return;

  const linesPerSlide = options.linesPerSlide ?? 4;
  const maxCharsPerLine = options.maxCharsPerLine ?? 45;

  yield* serverPluginApi.ai.chatCompletionStream(
    [
      {
        role: "system",
        content: buildSystemPrompt(linesPerSlide, maxCharsPerLine),
      },
      { role: "user", content: buildUserPrompt(trimmed) },
    ],
    {
      model: "deepseek/deepseek-v4-flash:nitro",
      temperature: 0,
      reasoningEnabled: false,
    },
  );
}
