# PowerPoint slideshow tools

Helpers for reverse-engineering PowerPoint for the web's slideshow data. See
`docs/OFFICE-ONLINE-SLIDESHOW.md`. Not part of the build.

## Test deck

One feature per slide (transitions, timing chains, builds, emphasis, exits,
motion paths, triggers, video), each slide titled with what it tests.

```bash
python3 -m venv /tmp/pptx-venv && /tmp/pptx-venv/bin/pip install python-pptx lxml
# assets: clip.mp4, poster.png, picture.png (any small video/images)
/tmp/pptx-venv/bin/python make_test_deck.py <assetsDir> out.pptx            # all slides
/tmp/pptx-venv/bin/python make_test_deck.py <assetsDir> out.pptx 1,2,3      # a subset, by title number
```

## Capture

Fetches what the viewer would: presentation info, every slide's JSON and every
sprite sheet. The deck must be at a public URL.

```bash
node capture.mjs <publicPptxUrl> <outDir> [format=6]
```
