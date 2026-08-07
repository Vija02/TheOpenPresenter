# @repo/layout

Slide-content layout: a JSON document describing text, images and shapes inside
one scene, plus the renderer and editor for it.

Not to be confused with **renderer layout** (`RendererLayout` in
`@repo/base-plugin`), which composes whole scenes onto an output. That one hosts
plugin web components and needs real pixel boxes; this one draws its own content
and scales it. They share the `Rect` shape and nothing else.

## Entry points

| Import | Contains | Ships to |
|---|---|---|
| `@repo/layout` | schema, geometry, template resolution, font registry. Pure TS, no React | anyone |
| `@repo/layout/react` | `LayoutRenderer`, `Stage`, element views, text measurement | renderers |
| `@repo/layout/react/css` | `@font-face` + `.lay--stage` / `.lay--box` | renderers |
| `@repo/layout/editor` | `LayoutWorkbench`, `LayoutEditor`, inspector | editors only |
| `@repo/layout/editor/css` | the above plus everything in `react/css` | editors only |
| `@repo/layout/ai` | prompts, tool schemas, tool execution, `layoutAgentToolset`. Pure TS | servers only |

**`./editor` must never be imported from `./react`.** It pulls `react-moveable`
and `react-selecto`; renderers must not ship them. `editor.css` `@import`s
`react/styles.css`, so importing the editor stylesheet alone is sufficient.

Current consumers:

- `apps/renderer` — `react/css` only (the JS arrives through the bible bundle)
- `apps/remote` — `editor/css`, plus `LayoutEditor` in `InteractiveLayoutEditor`
- `plugins/bible` — root types, `react` for `LayoutRenderer`, `editor` for its
  Slide Template dialog

## Document model

```
LayoutDoc
├─ version: 1                       LAYOUT_DOC_VERSION — bump = migration
├─ aspectRatio: { width, height }
├─ fitMode: "fluid" | "letterbox"
└─ elements: LayoutElement[]        array order IS paint order; there is no zIndex
```

Every element carries `id`, `name`, `rect`, `rotation`, `opacity`, `locked`,
`hidden`, `hideWhenEmpty`, `fill`, `stroke`, `effects`, `radius`, `clip`. On top
of that base, the discriminated union adds:

- **text** — `content` (the raw template), `fit`, `style`, `spanRoles`
- **image** — `src`, `fit`
- **shape** — `kind`

`rect` is `{ x, y, w, h }` in 0–100, so a document survives an aspect-ratio
change and one geometry type serves both layout levels.

Element `id` is identity — stable ids are what make template swapping and future
transitions possible. Mint them deterministically.

## Scaling

Percentages can position a box but cannot express font size, stroke width,
radius or shadow blur. So elements live in a canonical design space and `Stage`
applies one uniform scale factor; every scalar scales without special-casing.

- **`fluid`** (default everywhere) — rects are a % of the actual box, scale is
  `actualWidth / designWidth`. Stretches to any container.
- **`letterbox`** — pillarbox/letterbox to the design aspect. Exact WYSIWYG, for
  templates where stretching would look wrong.

`fitMode` is on the document but has no UI: it defaults to `fluid` in
`createLayoutDoc`, `Stage` and `LayoutEditor` alike, and is best chosen by a
template rather than exposed as a knob.

## Templates and bindings

A plugin owns segmentation — how a passage splits into slides is genuinely
plugin logic and stays there. The template owns presentation of one segment.

The plugin declares `DataBinding[]` (key + label + type) and emits a `FrameData`
per slide; `resolveDoc(doc, data, frame)` substitutes tokens and returns
`ResolvedDoc`. Tokens are resolved **at render time, never at store time** — the
document keeps `"{{reference}} ({{translation}})"` so live data keeps flowing.

Supported: `{{key}}` substitution, `{{n}}` / `{{total}}` index tokens, rich spans
carrying a `role` that the template styles via `spanRoles`, and `hideWhenEmpty`.
No expressions, loops or repeaters.

`resolveDoc` drops `hidden` elements and `hideWhenEmpty` ones whose data is
empty, so the editor canvas shows exactly what output will.

## Text fitting

| `fit` | UI label | `style.fontSize` | Behaviour |
|---|---|---|---|
| `declared` | Fixed size | exact | verbatim, no measurement — long text overflows |
| `shrinkToFit` | Shrink to fit | ceiling | that size until it would overflow, then shrinks (wrapping) |
| `fitNoWrap` | Fit (no wrap) | ignored | largest that fits **without wrapping**; only explicit newlines break |
| `wrap` | Wrap and fit | ignored | largest that fits, wrapping freely |

The last three share one binary search, differing only in `white-space` (`pre`
for `fitNoWrap`, `pre-wrap` otherwise) and whether `style.fontSize` caps the
search.

Both values preserve authored newlines — `nowrap` and `normal` collapse them
into spaces, which silently ate every line break typed in the inline editor.
Line breaks carry meaning in lyrics and verse text, so `white-space` is never
`normal` here, in any fit mode.

`shrinkToFit` vs `wrap` is the difference between "at most this big" and "as big
as possible": short text stays at the authored size under `shrinkToFit`, but is
blown up to fill the box under `wrap`.

Because the search converges from below and then floors, `fitFontSize`
short-circuits when the ceiling already fits — otherwise `shrinkToFit` would
render a pixel under `declared` in the common case where nothing overflows.

**The rendered element and the measure node must agree on `white-space`**, or
the fitted size is computed against a different line count than the one drawn.
That coupling lives in `TextElement.tsx` and `measure.ts`; anything else that
calls `fitFontSize` (the inline editor's re-fit does) has to pass the same
`noWrap`.

`lyrics-presenter` solves the same problem differently, measuring once at `1rem`
via SVG `getBBox` and letting a `viewBox` scale itself, which is resize-free.
That approach was not adopted here: SVG text cannot host a useful
`contenteditable`, which would cost inline editing, and it requires the caller
to pre-split lines.

`fitFontSize` (`react/text/measure.ts`) runs **synchronously during render** so
the first paint is already correct, and memoises into a 500-entry FIFO cache
keyed on a hash of the full spec.

## Fonts

`fonts/registry.ts` is the single source of what the platform can render:

- **bundled** — Inter, Source Sans 3, Open Sans, Montserrat, Oswald, Playfair
  Display, shipped as `@fontsource-variable/*` and pulled into both stylesheets
  by `react/styles.css`. Identical on every machine, so the editor measures what
  the projector draws.
- **system** — `system-ui`, Arial, Times New Roman, Courier New. Kept because
  the Liberation family is metric-compatible with the last three almost
  everywhere, so auto-fit stays correct even when the named face is missing.
  Faces without a metric-compatible substitute were deliberately excluded: they
  break the fit across machines, not just the look.

`style.fontFamily` stores a **raw CSS stack**, not a registry id, so documents
predating the registry need no migration. `findFontOption` falls back to
matching the primary family, and the picker surfaces an unknown stack as
`Custom (…)` rather than silently rewriting it.

Because a webfont arriving late would otherwise leave a wrong size cached
forever, `LayoutRenderer` preloads exactly the families a document references
and `text/fontStatus.ts` bumps a generation counter that is folded into the
measure cache key, forcing a re-fit.

## Editor

```
LayoutWorkbench          template rail + canvas + contextual inspector
└─ LayoutDocEditor       LayoutDoc ⇄ editor items; owns inline-edit state
   └─ LayoutEditor       generic, doc-agnostic: moveable + selecto + nudge
```

`LayoutEditor` knows nothing about `LayoutDoc` — it takes `items` with a `rect`
and a `rotation` and emits `RectChange[]`. Selection is internal view state in
`LayoutWorkbench`; the document itself stays controlled.

Behaviour worth knowing:

- **Gestures commit once on release**, never per frame — consumers persist to a
  CRDT and per-mousemove writes are a firehose.
- **`rotation` on a `RectChange` is optional**, and absent means "the gesture
  did not touch the angle" — distinct from `0`, which means "unrotated". A
  keyboard nudge omits it so it cannot flatten an existing rotation. `rect`
  always rides along with a rotate, since spinning about a corner also moves
  the box.
- **The editor wrapper owns the angle, not the element view.** `rotation` is
  applied by `placementToCss`, which no-ops under `placement="fill"` — the
  placement the editor uses. Moveable transforms that wrapper directly, so
  rotating the child too would compound into double the angle.
- **Snapping is scoped to `["draggable", "resizable"]`.** `bounds` feeds
  snapping, and for a rotate Moveable reads it as "no corner may leave the
  stage", which makes anything near full-bleed impossible to spin. Rotation is
  allowed to overhang and the stage clips it.
- **Rotation snaps to 15°, and Shift rotates freely.** Applied in
  `onBeforeRotate` rather than through `throttleRotate`, which is a prop and so
  cannot see a modifier held mid-drag.
- **One rotation handle, above the box** (Moveable's default). It sits ~40px
  outside and `.lay--editor` clips, so an element flush to the top of the stage
  has no reachable handle — that is what the inspector's numeric Rotation field
  is for.
- **`locked` blocks transform, not selection.** Moveable's targets exclude
  locked items but Selecto still selects them, so a locked full-bleed background
  can be clicked and restyled through the Fill section, and its own Locked
  checkbox can always be unticked.
- **Double-click a text element to edit in place.** The overlay renders through
  `ElementView` with the spans swapped for the raw template, and sets
  `contenteditable` on `.lay--text-content` — the styled node itself, so
  select-all-delete cannot destroy the styling. Size is re-fitted imperatively
  on `input`; re-rendering per keystroke would move the caret.
- **Clicking outside the slide deselects**, tested via `closest(".lay--editor")`
  rather than `e.currentTarget` because an aspect-ratio wrapper sits in between.

## AI editing

Natural-language editing is a **platform capability, not a plugin's job**, and is
on by default — a host that stores a `LayoutDoc` gets it for free:

```tsx
<LayoutWorkbench doc={doc} onChange={setDoc} aiThreadKey={`bible:${pluginId}`} />
```

The panel hides itself when the server has no AI provider configured, so there is
nothing to gate on. Three props adjust it, none of them usually needed:

- `ai={false}` — omit the panel in a surface where it does not belong.
- `aiCapability="bible.layout"` — use a plugin's own capability instead of the
  platform default.
- `onRequestAiEdit` — run the request yourself, bypassing the shared `/ai`
  endpoint entirely.

```
LayoutWorkbench            owns the useAiChat instance (not DocumentInspector,
│                          which unmounts whenever an element is selected)
└─ createAiCapabilityRequest()       POST /ai/layout, SSE -> AiChatStep      @repo/layout/editor
   └─ installAi            resolves the capability by id           backend/server
      └─ layoutCapability  validates the request                   backend/server/src/ai
         └─ runDocAgent    the turn loop, tool dispatch, budgets   @repo/base-plugin/server
            └─ layoutAgentToolset  tools + prompt + transforms     @repo/layout/ai
```

The split is deliberate. `runDocAgent` is domain-agnostic — bound the turns,
apply each call, feed tool failures back rather than throwing, always end with a
document — so the next AI document feature reuses it rather than copying it.
`@repo/layout/ai` holds everything layout-specific and ships to the browser, so it
cannot import `@repo/base-plugin/server` (express, pg, pino) — it satisfies
`DocAgentToolset` structurally instead. The wire types it does need (`ChatTool`,
`ChatMessage`) come from `@repo/base-types`, which is dependency-free for exactly
this reason; drift is caught where the capability is registered.

To customise, register an `AiCapability` from a plugin's `init`: the **same id**
(`layout`) replaces the default everywhere, a **namespaced id**
(`bible.layout`) adds a variant that only callers passing
`layoutAiRequest("bible.layout")` get. Built-ins skip any id a plugin already
claimed.

### Choosing the model

A capability's id doubles as its provider profile, so the model is env config
rather than a code change:

```bash
AI_API_KEY=...              # the default provider, used by everything
AI_MODEL=deepseek/v4-flash

AI_LAYOUT_MODEL=cc/claude-opus-5          # just this capability, same account
AI_LAYOUT_VISION_MODEL=google/gemini-3-pro   # ...and only when an image is attached
```

Resolution is most-specific-first, falling through each level:

```
image attached   AI_LAYOUT_VISION_*  ->  AI_LAYOUT_*  ->  AI_*
text only                                AI_LAYOUT_*  ->  AI_*
```

So vision is **opt-in per capability**: set nothing and image requests just use
the capability's own model, which is usually fine — most current models take
images. Set `AI_LAYOUT_VISION_MODEL` only when the capability's normal model is
text-only, or when a cheaper model is good enough for reading a reference slide.

Credentials and model resolve independently, which is what makes the common case
cheap: `AI_LAYOUT_MODEL` alone needs no key duplicated. Add `AI_LAYOUT_API_KEY`
(plus `AI_LAYOUT_BASE_URL`) to move a capability to a different account. A key
and its base URL always travel together — whichever profile supplies the key
supplies the host, since a key is only valid against the host that issued it.

Tools live in `src/ai/tools.ts`, declared once as zod schemas so the JSON Schema
the model sees and the validation its arguments face cannot disagree. Two things
worth knowing:

- **Targeted tools are preferred over `replace_document`.** A wholesale rewrite
  risks every element id and every `{{token}}` at once, and the damage is
  invisible to a validator — the slide still renders, it is just blank where the
  verse used to be. `replace_document` reports dropped tokens in its result
  rather than rejecting them, since dropping one is sometimes what was asked for.
- **Read-only tools do not mark the run as changed**, so Undo never offers to
  revert a no-op, and their (large, JSON) results are summarised for the user
  rather than dumped into the transcript.

## CSS classes

Plain prefixed CSS, not Tailwind-mangled — this package is transform maths you
end up eyeballing in devtools.

| Class | Where |
|---|---|
| `.lay--stage`, `.lay--box` | renderer |
| `.lay--text-content` | text container; the inline editor's `contenteditable` host |
| `.lay--workbench-canvas` | the surround; clicking it deselects |
| `.lay--editor`, `.lay--editor-surface` | editor frame and canvas |
| `.moveable-rotation-control` | rotation handle; touch hit area only |
| `.lay--editor-item` + `--selected` / `--editing` | one element |
| `[data-lay-id]` | element by id |

`.lay--text-content` and `.lay--workbench-canvas` are load-bearing: the first is
the editor's `TEXT_HOST_SELECTOR`, the second is a selector in the e2e suite.

## Constraints

- **Nullable, never optional, for anything persisted.** Use `| null`, not `?` —
  valtio-yjs recurses infinitely on `undefined`.
- **Bump `LAYOUT_DOC_VERSION`** for any schema change that isn't additive with a
  default.
- Anything stored as a raw CSS value (font stacks especially) should stay that
  way; narrowing to an enum turns a UI change into a document migration.

## Tests

`e2e/tests/integration/layout/layoutEditor.spec.ts` drives the editor through
bible's Slide Template dialog — the only surface that mounts `LayoutWorkbench`.
It covers move/resize/typography, hover, selection, deselection, and inline
editing against **both** fit modes, since bible's body is `wrap` and its
reference is `declared`.

```
yarn e2e test layoutEditor --project=chromium
```

## Known gaps

- No `theme` on `LayoutDoc`; every element carries its own style.
- No org-level template library — templates live in each scene's `pluginData`.
- `lyrics-presenter` still has its own parallel style system and has not been
  migrated.
