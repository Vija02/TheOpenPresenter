# PowerPoint playback

PowerPoint imports carry `office` (an `OfficeDeck`): shapes, sprite sheets and
animations captured from PowerPoint for the web at import. We play them with our
own renderer. The service, its fields and enums are in
`docs/OFFICE-ONLINE-SLIDESHOW.md`; read that before changing anything here.
`SUPPORT.md` lists what plays: update it when that changes.

## Files

- `types.ts` - the stored model. It lives in Yjs on the import, so keep it plain
  JSON and backwards compatible: old imports keep whatever was captured then.
- `normalize.ts` - service JSON -> model. The only place that knows raw field
  names and enum numbers.
- `timeline.ts` - click groups and start times (the viewer's
  `translateAnimations`), and how they map onto the navigation model.
- `effects.ts` - entrance/exit keyframes, transcribed from the viewer.
- `evaluate.ts` - (slide, group, elapsed ms) -> each target's state. Pure.
- `transitions.ts` - transition type -> what we draw, and for how long.
- `morph.ts` - the Morph transition's easing and per-object layers.
- `media.ts` - which videos play, and how far in, for a step. Pure.

Rendering is `view/Renderer/PowerPointRenderer/`; the presenter's previews draw
the same `OfficeSlideView` settled.

## Rules

- **Match the viewer, not our idea of PowerPoint.** Timing, fallbacks and
  constants follow its code so a deck plays as it does on the web. If you
  change one, say where in the viewer it comes from.
- **Pure evaluation.** Every screen computes the frame from the same inputs
  (`activeSince`, click count, slide data). No per-screen animation state.
- **Only the step a press started animates.** The renderer plays while
  `transitionEndsAt > activeSince` (or autoplay is on); anything else, such as a
  jump, a PREV or a snap, lands settled.
- **Navigation sees PowerPoint like Google Slides.** `slideClickCounts`,
  `slideClickDurations`, `slideAutoplayDurations` and `slideTransitionDurations`
  are written at import from `navigationTiming`. Changing the timeline does not
  fix decks already imported; they need re-importing.
- **Fallback is the image import.** Any capture failure, or slides that don't
  line up with the PDF pages, leaves a plain image import. Never fail the
  import over animations.
