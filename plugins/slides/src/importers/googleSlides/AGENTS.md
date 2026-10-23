# Google Slides navigation rules

We render the real Google Slides embed in an iframe and drive it with synthetic
arrow-key presses. Nothing here is documented by Google — the rules below were
found by observation, and the controller in `../../index.ts` exists to reproduce
them. Get a rule wrong and the renderer desyncs from the tracker by one click.

Scope: this folder does import-time extraction (`slideData/`), but the rules are
Google-Slides-specific, so they live here. The navigation controller itself is
the key-press handler in `../../index.ts` (lines 185-317).

## 1. Rulebook (empirical, load-bearing)

**Transitions vs. builds**

- A **slide transition** is an animation whose step targets the slide/page
  object itself (`targetElementId === slideId`). It plays automatically on
  arrival and consumes **no** click.
- A **build** is an animation targeting an element on the slide. An on-click
  build consumes exactly one click.
- `onClick` flags do **not** tell them apart — both can be `onClick: true`.
  Only the target does.

**Steps and groups**

- One press = one **step**. A step is either a slide transition (entering a
  slide) or an object-animation group: one on-click animation plus every
  *with-previous* / *after-previous* animation chained after it. A group plays,
  skips, and undoes as one unit.
- **A slide change is always its own step.** Never automatic, never bundled, so
  a step never spans two slides.
- An automatic object that runs on slide entry is bundled into the transition
  going *forward*, but the slide boundary still costs its own press going
  *backward*.

**Forward (Right / `NEXT`)**

- Settled → run the next step; its animation plays.
- Mid-animation → finish the current animation **and** perform the next click
  (advance one step) — **except** when the next step would change slides, where
  it only finishes the animation and stays put. A slide change always needs its
  own settled press.

**Backward (Left / `PREV`)**

- **Objects do not reverse-animate.** Left on an object group makes the whole
  group vanish at once.
- **Slide transitions DO play backwards**, with the same duration as forward.
  This reverse animation is unique to transitions.
- **The slide boundary is its own press.** Objects that entered with a slide
  detach when reversing: Left removes the objects, *another* Left plays the
  reverse transition.
- Opposite direction **cancels** an in-flight animation and returns to the state
  before that press; same direction **completes** (skips) it. Cancelling a
  reverse transition does not re-run the automatic objects.

**Jumping**

- `goToSlide` (type digits + Enter, see `RenderView.tsx`) always lands on build
  0, regardless of direction. To land mid-slide you must fire `clickCount`
  `next()` presses afterwards — that's what `jumpToPosition` does.

## 2. Position model

Single source of truth in renderer data: `currentSlideIndex` +
`currentClickCount`. Everything else is derived.

- `clickCount` per slide = number of on-click build groups, from
  `slideClickCounts` (computed at import).
- `clickCount === -1` is the **autoplay-rewind sub-step**: the slide is shown
  with its auto-playing entry object removed. Only reachable on slides with
  `slideAutoplayDurations > 0`.
- **Flat position** (`toFlatPosition`, `src/slides/autoplay.ts`) linearizes
  `(slideIndex, clickCount)` into one monotonic integer; each slide occupies
  `clickCount + 1` steps (the `+1` is the press that leaves the slide). **One
  unit of flat position === one arrow key**, including the boundary press. That
  equivalence is why the renderer can drive the iframe by stepping.
- Flat position clamps negatives, so `-1` and `0` share a flat position; the
  renderer distinguishes them with its own `localClickCountRef`.
- **Our steps vs the embed's.** `slideClickCounts` is what we navigate by. It
  adds one step per "Play (manually)" video (§10) **after** all of the embed's
  own, which are `slideVideos[slide].embedClicks` (missing = the same). Anything that
  drives an embed (renderer, speaker-view capture) must use the embed's count,
  via `getEmbedClickCount` / `toEmbedClickCount` in `order.ts`: the embed sits
  at `min(ours, embed's)`, so our extra steps are flat delta 0 and never become
  key presses.

## 3. What import extracts

`slideData/slideDataExtractor.ts` walks each slide's animation sequences and
classifies them:

- sequence targeting the slide id → transition; duration →
  `slideTransitionDurations`. If such a sequence has **more than 2** animations,
  the extras are an auto-playing object; `totalDuration - transitionDuration` →
  `slideAutoplayDurations` (a transition sequence always carries 2 entries — a
  Google quirk).
- sequence index 0 with `autoPlay` set → auto-playing object →
  `slideAutoplayDurations`.
- anything else → one click; `totalDurationMs` appended to
  `slideClickDurations[slideIndex]`, and `slideClickCounts` incremented.

Read them back only through `../../slides/order.ts`
(`getClickCountForSlide`, `getTransitionDurationForSlide`,
`getClickDurationForSlide`, `getAutoplayDurationForSlide`) — those resolve the
global slide order and return 0 for non-Google imports.

## 4. Controller: how a press is handled

All mutations for one press happen in a single `rendererData.doc.transact()`.
Every press stamps `lastClickTimestamp` and clears `isTransitioningBackwards`
(only a backward boundary crossing re-arms it).

`transitionEndsAt` is the **boundary window**: the epoch ms at which the
currently-playing step finishes. `0` means "no window / closed".

**NEXT**

1. At the slide's last click (`currentClickCount >= max`) and inside the window
   → **snap**: set `transitionEndsAt = 0` and change nothing else. This is rule
   §1's exception — skip the animation without crossing the boundary.
2. More clicks left → `currentClickCount + 1`, window =
   `now + getClickDurationForSlide(...)`. If the new click is one of our added
   steps, the window is left **untouched**: the embed hasn't moved, so whatever
   it is still playing keeps its window, and rule 1's snap still finishes it.
3. Otherwise, not the last slide → next slide, `currentClickCount = 0`, window =
   `now + transitionDuration + autoplayDuration` (of the slide being entered).
4. Last slide, all builds shown → nothing.

Non-boundary presses get a window but no snap, so they finish-and-advance
natively (one key = one step).

**PREV**

Leaving one of our added steps → `currentClickCount - 1` and the window is
left **untouched** (closing it would read as a snap to the renderer, which
would press Right). Otherwise it always clears `transitionEndsAt` first:
backward object steps are instant, so they get no window. Then:

1. `currentClickCount > 0` → `currentClickCount - 1`.
2. `currentClickCount === 0` and the slide has an autoplay object →
   `currentClickCount = -1` (peel the auto object off before leaving).
3. Otherwise, not the first slide → previous slide at its max click count, and
   arm the reverse window: `transitionEndsAt = now + reverseTransitionMs` with
   `isTransitioningBackwards = true`. The transition that reverses belongs to the
   slide being **left** (`currentSlideIndex`), not the one being entered — it's
   the same transition that played on the way in.
4. First slide at click 0 → nothing.

**During a reverse transition** (`isTransitioningBackwards && now < transitionEndsAt`),
handled before the branches above:

- `NEXT` → cancel: return to `currentSlideIndex + 1`, click count `-1` if that
  slide has an autoplay object else `0` (the auto objects do not re-run), window
  closed.
- `PREV` → complete: snap to `maxClicksForCurrentSlide`, window closed.

## 5. Renderer contract

`view/Renderer/GoogleSlideRenderer/useIframeSync.ts` consumes only
`targetSlideIndex`, `targetClickCount`, `targetFlatPosition`,
`transitionEndsAt`, `lastClickTimestamp`. `isTransitioningBackwards` is
controller-internal — nothing reads it.

- Flat delta `+1` → one `next()`, and arm a local window of
  `transitionEndsAt - lastClickTimestamp`. Both stamps come from the same press,
  so the duration is clock-skew-free; the local deadline uses `Date.now()`.
- Flat delta `-1` → one `prev()`, and arm the window the same way. Only a
  backward slide crossing has one; the controller closes it for builds.
- Any other delta → `jumpToPosition` (goToSlide + steps), window cleared.
- Delta `0` but `targetClickCount` differs → the `-1` autoplay sub-step: one
  `prev()`/`next()`.
- Delta `0`, `transitionEndsAt === 0`, local window still open → that's the
  controller's **snap**: finish the animation with the key that armed the
  window and do not move the position. `next()` for a forward step; `prev()`
  for a reverse transition, where the embed's Left completes it and stays
  (measured: `3,-1: L 30..300ms L` lands on `2,3`, a further Left goes to
  `2,2`). A `next()` there would cancel the transition instead.
- Forward onto a step that plays a video (or a jump landing on one, or `-1` →
  `0` replaying an automatic one): **finish it** with the keys from
  `embedVideoFinish` once the step's window (a transition) has played out. The
  embed's video never plays, so its step never ends; unfinished, the next
  press would only finish it and the embed would fall a step behind (§10).
  Any other key cancels a pending finish.

## 6. Known gaps

- Object-group bundling beyond what `clickCount` already collapses is not
  modelled.
- `goToSlide` + `next()` stepping in `jumpToPosition` is spaced by `STEP_MS`
  (50ms); very long build chains land slowly.

## 7. Persistence caveat

`slideClickCounts`, `slideVideos`, `slideTransitionDurations`,
`slideClickDurations`, `slideAutoplayDurations` and the video fields are
written **at import time**. Changing extraction
logic does not retroactively fix already-imported decks — they must be
re-imported. All the Google-only fields are optional; treat a missing value as
"unknown" and fall back to 0.

## 8. Gotchas

- Don't count transitions as clicks. Symptom: one phantom click per transitioned
  slide.
- Don't advance the position on a snap. Snaps close the window; the tracker and
  renderer must stay in agreement.
- Don't use `jumpToPosition` for a sequential move — it lands cold and the
  animation never plays. It's for init, re-entry, and multi-step jumps only.
- If you touch backward navigation, implement the rule fully or leave it
  clearly unhandled. A half-implementation desyncs tracker and renderer.

## 9. Key files

- `../../index.ts` (185-317) — key-press handler; also the import flow.
- `slideData/slideDataExtractor.ts` — parses the embed's `docData`; per-slide
  click count and durations.
- `../../slides/order.ts` — resolve a global slide index to its import + data.
- `src/slides/autoplay.ts` — flat-position math.
- `view/Renderer/GoogleSlideRenderer/useIframeSync.ts` — drives the iframe.

## 10. Videos

The embed only plays a video when someone clicks it inside the iframe, so we
play them ourselves: `slideVideoDocs` holds, per slide, a transparent layout
doc with each video at its place, drawn over the slide by
`view/Renderer/SlideVideoOverlay` and activated like a custom slide's video
(`src/slides/activation.ts`). Positions come from docData `slide[4]`, as two
corners `[left, top, right, bottom]` (not a size) in the same units as the
slide size (`slideSize`); `videoType` 1 is YouTube, 2 Drive. Each video sits on
a black box so the embed's own (failing) player never shows through.

**When each video plays** (`slideVideos[slide].startClicks`, by element id;
read in `src/slides/activation.ts`). The setting isn't on the video in docData but in
the slide's animations, as a step with easing type `6` (`MediaPlay`) targeting
the video's element:

- "Play (on click)": a click sequence. The embed counts it as a build, so the
  video starts on that click.
- "Play (automatically)": in the autoplay sequence. Plays on entering the slide
  (and is paused at `-1`, the autoplay-rewind sub-step).
- "Play (manually)": no animation at all, and no step in the embed. We add one
  (§2), so it starts on its own press.

Mapped onto layout's own video controls: a video that waits for a click is
`start: "manual"` in the overlay doc, so it holds on its first frame when the
slide comes on screen. A press that crosses its click starts it, and stepping
back before it rewinds it, both through `controlVideoFills` (`updateSlideVideos`,
from the key handler); a press that crosses no video's click touches none.
Entering a slide also starts the video of the click it lands on (a jump), and
on a slide shown as an image, where there are no clicks, every video plays on
entry. Trim is fields 5 and 6 of the video array, in ms (0/null = none);
parsed, not yet applied.

**The embed's own video never ends** (measured, see embed-capture.md). In our
renderer it can't load, so a play step is a build whose animation never
finishes, and §1's rule applies: the next press only finishes it. Unhandled,
that cost one extra press per on-click or automatic video, and the tracker
(which took Google's nominal 1s) fell behind: a desync on every deck with
videos.

We keep presses to what an operator expects (play, then move on) and absorb
the quirk instead: the renderer finishes the embed's video as soon as its step
starts (§5), and import gives video steps no time (`slideClickDurations` 0;
an automatic one's `slideAutoplayDurations` 1, still an autoplay object for
the `-1` sub-step). A tracker window there would make its snap press Right on
an embed that is already finished, crossing the slide.

- **YouTube** goes straight in at import.
- **Drive** can't be read with our `drive.file` token until the user picks the
  file in the Google Picker (`view/Remote/DriveVideoAccess.tsx`, picker limited
  to those file ids; on a cloud-linked install, the cloud pick page with
  `fileIds` in the intent). Then `driveVideos.ts` downloads it via the Drive API,
  uploads it as media and adds it to `slideVideoDocs`. Import tries once
  quietly, which covers re-imports of videos picked before. Until then the
  video's poster (`slide[13]`, by element id; already copied at import) covers
  it.
- Dead ends, measured: the Drive API says 404 for unpicked files; the embed's
  own playback API (`workspacevideo-pa.clients6.google.com/v1/drive/media/{id}/playback`)
  answers 403 "insufficient authentication scopes" to our token.
