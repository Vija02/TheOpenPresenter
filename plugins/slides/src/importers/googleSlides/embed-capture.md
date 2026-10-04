# Driving the embed to capture positions

Measured on the e2e sample deck (`e2e/sample-files/sample.html`, see
`e2e/helpers/slidesSeed.ts`) in Chromium and Firefox. The probe walked the
embed through every position and fingerprinted the drawn slide (per shape:
visible, opacity, transform), so "lands on X" below means it matched X as
reached by patient key presses. Read `AGENTS.md` first; this adds what matters
for landing on a position _already finished_, which the speaker view needs to
picture previous/next steps.

Sample deck, for reading the numbers:

| Slide | Transition | Autoplay object | Builds (ms)       |
| ----- | ---------- | --------------- | ----------------- |
| 0     | 0          | 0               | 1 (500)           |
| 1     | 0          | 900             | 0                 |
| 2     | 500        | 0               | 3 (300, 600, 300) |
| 3     | 400        | 300             | 1 (0)             |

## What a press does

- **Right, settled:** plays the next step. Builds take their own duration;
  entering a slide plays its transition (and then its autoplay object).
- **Right while a build plays, more builds after it:** finishes that build
  _and_ starts the next one. `2,0: R 30ms R` lands on `2,2` (mid-animation).
- **Right while a slide's last build plays:** only finishes it.
  `2,2: R 30ms R` settles on `2,3`; it does not cross.
- **Right while a slide transition plays:** finishes the transition and runs
  the first build. `1,0: R 30ms R` settles on `2,1`; `2,3: R 30ms R` on `3,1`.
- **Right while an entry autoplay object plays, no builds:** finishes it and
  stays. `0,1: R 30ms R` settles on `1,0`.
- **Left on a build:** removes it instantly (no reverse animation). Measured
  0ms of style changes after the press.
- **Left at 0 on a slide with an autoplay object:** goes to `-1` instantly,
  even while the object is still animating (`0,1: R 30ms L` lands on `1,-1`).
- **Left at 0 (no autoplay) or at -1:** goes to the previous slide's last
  build, playing the transition of the slide being left backwards
  (`3,-1: L` is busy 415ms; `2,0: L` and `1,-1: L` are instant because those
  slides have no transition).
- **Left while a slide transition plays:** cancels it, back where it started
  (`1,0: R 30ms L` stays on `1,0`; `2,3: R 200ms L` stays on `2,3`). Once the
  transition has ended and only the entry autoplay plays, Left goes to `-1`
  instead (`2,3: R 550ms L` lands on `3,-1`).

## Jumping (`goToSlide`)

- Lands on build 0 **without** the slide transition, from anywhere, in any
  direction. It does play the entry autoplay object (`G1` busy 900ms, `G3`
  300ms).
- **It never lands on `-1`.** The only way to `-1` is Left from 0.
- Jumping to the slide already showing does nothing, even if it is at a later
  build (`2,2` then `G2` stays on `2,2`). Don't use it to reset a slide.

## Finishing an animation without moving ("snap")

The embed has no "skip" command; Right is the only key that finishes an
animation, and what else it does depends on what follows:

| Playing        | Next on the slide | Do                              | Result                                                                                   |
| -------------- | ----------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| a build        | another build     | Right, Left                     | finished, same position (Right starts the next build, Left removes it at once)           |
| the last build | nothing           | Right, only while still playing | finished, same position. If the build already ended, Right **crosses** to the next slide |
| entry autoplay | a build           | Right, Left                     | finished at 0                                                                            |
| entry autoplay | nothing           | wait it out                     | Right would finish it, but crosses if it already ended; not worth the race               |
| nothing        |                   | nothing                         | Right, Left on a settled slide is harmless only if a build follows                       |

So a capture never relies on timing to stay on a slide: it snaps only when
another build follows, and otherwise waits for the measured duration. The plan
is `view/Remote/PresenterView/capture/capturePlan.ts`.

## Telling "settled" from "still animating"

- `document.getAnimations()` is always empty; the embed animates by writing
  inline `style` on SVG `<g>` elements on a timer.
- So: a MutationObserver on `style`/`class` attributes. The embed has finished
  when there have been no such mutations for a short quiet window (120ms is
  ample; animation frames come every ~16ms). Still wait at least the measured
  duration, because a step can start a few ms after the key press.

## Which slide is showing

- Each slide is an `<svg>` under `.punch-viewer-svgpage-svgcontainer`. The
  embed keeps a couple around (the one being left stays in the DOM, sometimes
  with zero size, sometimes full size underneath). **Don't pick the first one
  with a width**: after `G2` then `G3` both are full size.
- The showing one is the one under the centre of the viewport
  (`document.elementFromPoint`).
- The slide's id (from `slideIds`) appears in its SVG as a
  `clipPath#{slideId}.0`, and usually also as `<g id="{slideId}">`. The `<g>`
  is not always drawn: sample slide 3 has none in the live DOM though its
  source has one. Match either. That makes a capture self-checking: confirm
  the id before storing.
- `location.hash` stays empty; it can't be used.

## Capture pitfalls

- Copying the SVG is enough: the embed writes each shape's visibility and
  opacity onto the SVG itself. Copying computed styles changed nothing.
- Copies are put into the page side by side, so their `id`s must be renamed;
  every slide defines `clipPath#p.0`-style ids that would clash.
- A capture embed must stay inside the viewport and painted (opacity 0 is fine)
  or the browser may throttle its timers.
