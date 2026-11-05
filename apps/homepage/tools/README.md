# Homepage tools

Scripts that make the homepage's drawings and the hero's remote screenshots.
Their output is committed; rerun them after changing them, never hand-edit
what they write. Run everything from `apps/homepage`.

## `sunday-scenes.py` (+ `scene_kit.py`)

Generates the SVGs in `src/assets/illustrations/`:

| File | Used by | What |
| --- | --- | --- |
| `hero-devices.svg` | `HomeHero.astro` | Main screen, confidence monitor, the musician's/pastor's tablet and the Wi-Fi hub, beside the remote |
| `hero-devices-mobile.svg` | `HomeHero.astro` | The same, stacked for phones |
| `edit-anywhere.svg` | `HomeTeam.astro` | Step 1, three people editing from home |

```sh
python3 tools/sunday-scenes.py
```

- `sunday-scenes.py` holds the content: the layouts, the demo songs (read from
  `backend/server/src/middleware/demoSongs.ts`) and the sermon deck (`DECK`,
  including the pastor's highlight and pencil marks).
- `scene_kit.py` holds the drawing helpers: device frames, live slides, the
  chord tablet, the speaker view, ink, labels and chips.
- Motion backgrounds are left as `__BG_HOW__` / `__POSTER_HOW__` (and `BML`)
  placeholders that `HomeHero.astro` fills in. The videos live in
  `public/videos/home/`.
- `python3 tools/sunday-scenes.py --deck-html` prints the deck's slides as
  HTML; the screenshot tool uses it.

The animation is `src/scripts/hero-remote.ts`, driven by the `sequence` in
`HomeHero.astro`. It finds things in the SVGs by class (`hero-main`, `cm-now`,
`cs-line`, `pv-root`, `ink` and so on), so keep those when changing the
drawings. The remote's box in the drawing (`REMOTE` in `hero()`) has to match
where `HomeHero.astro` places the screenshot.

## `remote-screenshots.mjs`

Captures the two remote screenshots from the real app and measures where the
hero's cursor clicks:

- `src/assets/images/home/hero-remote.png`: the Lyrics scene
- `src/assets/images/home/hero-remote-slides.png`: the Slides scene, with the
  thumbnails swapped for `DECK`
- `src/data/hero-remote.json`: click targets as percentages of the images,
  which `HomeHero.astro` reads

```sh
yarn dev                           # from the repo root, in another terminal
node tools/remote-screenshots.mjs  # uses ROOT_URL, else localhost:5678
```

It creates a fresh temporary demo project with `/init-demo?template=lyrics-songs`,
so nothing you already have changes. Before each capture it paints out the
live slide's red border (the hero draws its own) and removes the dev-only
Debug section. It finds things by their visible text, since most of the app's
class names are generated, so a UI change there may need a selector update.

After capturing, optionally save the Slides PNG with a 256-colour palette to
roughly halve its size (it's flat UI; the lyrics one has photo backgrounds and
would band). If a running `astro dev` then shows a stale or garbled
screenshot, restart it and hard-refresh.

## `signage-illustration.mjs` + `signage-compose.py`

Make the illustrations in the "control the screen from a tablet" section
of `/kids-ministry` and `/lobby-screens` (`SignageControl.astro`):
`src/assets/images/signage/control-kids.webp` and `control-lobby.webp`.

1. `signage-illustration.mjs` asks a Gemini image model for the scene on
   white: for `kids`, a TV and a tablet held from the bottom right; for
   `lobby`, a wall-mounted TV with a phone and a tablet below it. TV screens
   are solid magenta and the remote's thumbnails cyan. Needs
   `GEMINI_API_KEY` in the environment or `apps/homepage/.env.local`, on a
   project with billing.
2. `signage-compose.py` swaps those colours for the real frames and slides
   (listed in its `SCENES`; the lobby's come from a Canva Sunday
   worship template), removes the white background and crops to the
   objects.

```sh
node tools/signage-illustration.mjs --scene kids --count 2 --out /tmp/signage  # --aspect 3:4 by default
python3 tools/signage-compose.py /tmp/signage/kids-….jpeg kids src/assets/images/signage/control-kids.webp
```

Pick a draft where the TV and tablet face straight on.

The same two scripts make the device drawings in "A new screen in ten
minutes" (`SignageDevices.astro`, `src/assets/images/signage/devices/`). Use
`--scene firestick|googletv|raspberrypi|minipc|laptop`; drafts are square,
photoreal product shots. Google TV, Raspberry Pi and the mini PC are shot
on a magenta chroma-key backdrop: compose them with `key` (it also removes
magenta reflections). The Fire TV Stick and laptop are on a white studio
backdrop: compose them with `photo`. Only the laptop has a placeholder (its
screen).

```sh
node tools/signage-illustration.mjs --scene laptop --count 2 --out /tmp/signage
python3 tools/signage-compose.py /tmp/signage/laptop-….jpeg laptop src/assets/images/signage/devices/laptop.webp photo
python3 tools/signage-compose.py /tmp/signage/minipc-….jpeg minipc src/assets/images/signage/devices/minipc.webp key
```
