"""The homepage's drawings, driven by src/scripts/hero-remote.ts where they move.

- hero-devices.svg: the screens the remote drives in the hero (main screen,
  confidence monitor, the musician's or pastor's tablet, the Wi-Fi hub)
- hero-devices-mobile.svg: the same, stacked for phones
- edit-anywhere.svg: step 1 of "Prepare at home, together", editing from home

Styling comes from tools/scene_kit.py. Regenerate after editing:

    python3 tools/sunday-scenes.py

The motion backgrounds are left as placeholders (__BG_HOW__, __POSTER_HOW__
and the same for BML) and HomeHero.astro swaps in their URLs.
"""
import os

from scene_kit import (verse_x, verse_y, ACCENT, BEZEL, CANVAS, INK, LINE, SUB, SURFACE, chord_tablet, confidence,
                       deck_slide, deck_slides, frame, label, live_slide, pastor_view, text_width, turn_chip, wifi_dots,
                       wifi_hub)


# What the confidence monitor shows as next while the hero is on its first
# lyric (hero-remote.ts takes over from there)
FIRST_NEXT = ["Longing just to bring", "something that's of worth", "That will bless Your heart"]

# All slides share the cream look the pastor's highlight needs: the app
# multiplies highlighter yellow onto the slide, which only shows on light ones.
PAPER, INKY = "#F6F0E4", "#6B2412"


def circle_with_bangs(line, chars):
    """Pencil marks: a loop round the first `chars` of a scripture line, and
    "!!" past the end of it, one path per stroke in drawing order."""
    x0, x1 = verse_x(0) - 4, verse_x(chars) + 1.5
    cx, cy, rx, ry = (x0 + x1) / 2, verse_y(line), (x1 - x0) / 2, 5.2
    loop = (f"M{cx - rx * .3:.1f} {cy - ry * 1.05:.1f}"
            f"C{cx + rx * .4:.1f} {cy - ry * 1.15:.1f} {cx + rx * 1.02:.1f} {cy - ry * .6:.1f} {cx + rx:.1f} {cy:.1f}"
            f"C{cx + rx * .98:.1f} {cy + ry * .6:.1f} {cx + rx * .5:.1f} {cy + ry:.1f} {cx:.1f} {cy + ry:.1f}"
            f"C{cx - rx * .55:.1f} {cy + ry:.1f} {cx - rx:.1f} {cy + ry * .55:.1f} {cx - rx:.1f} {cy:.1f}"
            f"C{cx - rx:.1f} {cy - ry * .6:.1f} {cx - rx * .5:.1f} {cy - ry:.1f} {cx + rx * .15:.1f} {cy - ry * 1.1:.1f}")
    bangs = []
    for bx in (141, 146):
        bangs += [f"M{bx} {cy - 8:.1f}L{bx - .6} {cy + 2:.1f}", f"M{bx - .8} {cy + 5.6:.1f}l.1 .1"]
    return [loop] + bangs


def highlight(line, chars):
    """A highlighter stroke over the first `chars` of a scripture line."""
    y, x0, x1 = verse_y(line), verse_x(0), verse_x(chars)
    return [f"M{x0:.1f} {y:.1f}C{x0 + 30:.1f} {y + .5:.1f} {x1 - 40:.1f} {y - .6:.1f} {x1:.1f} {y:.1f}"]


# The sermon the hero switches to after the songs: Genesis 9, a verse or two
# a slide. tools/remote-screenshots.mjs puts the same slides in the remote's
# Slides tab, so indices here are the hero's slide numbers. On the middle slide
# the pastor highlights a line, then circles "I will remember" with the pencil.
DECK = [
    dict(ref="Genesis 9:13",
         lines=["I have set my rainbow in the clouds,", "and it will be the sign of the",
                "covenant between me and the earth.\u201d"]),
    dict(ref="Genesis 9:14-15", ink=[("highlight", highlight(1, 38)), ("pencil", circle_with_bangs(2, 15))],
         lines=["Whenever I bring clouds over the earth", "and the rainbow appears in the clouds,",
                "I will remember my covenant between", "me and you and all living creatures."]),
    dict(ref="Genesis 9:16",
         lines=["Whenever the rainbow appears in the", "clouds, I will see it and remember the",
                "everlasting covenant between God and", "all living creatures of every kind on", "the earth."]),
]
DECK = [dict(kind="scripture", bg=PAPER, fg=INKY, **d) for d in DECK]


def demo_songs():
    """Title and ChordPro content of the first two demo songs, read from the
    backend's demo data so the chord sheet matches what the demo shows."""
    import re

    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "..", "..", "..", "backend", "server", "src", "middleware", "demoSongs.ts")
    src = open(path, encoding="utf-8").read()
    songs = []
    for block in re.finditer(r'title: "([^"]+)".*?content: \[(.*?)\]\.join', src, re.S):
        lines = re.findall(r'"((?:[^"\\]|\\.)*)"', block.group(2))
        songs.append((block.group(1), "\n".join(lines)))
    return songs


def hero():
    """The hero's product shot on a 1000-wide canvas: the remote screenshot
    (placed over the empty top left by HomeHero.astro), the main screen beside
    it, and the musician's tablet and the confidence monitor below, all linked
    through the Wi-Fi hub in the middle. The main screen and the confidence
    monitor's NOW are live slides (motion background plus lyric text) and the
    tablet shows the whole song's chords; src/scripts/hero-remote.ts drives all
    three. Keep REMOTE in step with the remote's position in the component."""
    w, h = 1000, 724
    rx, ry, rw, rh = REMOTE = (0, 24, 600, 294)   # the remote screenshots, 1430x700 (tools/remote-screenshots.mjs)
    mx, my, mw, mh = 640, 24, 360, 203
    cx, cy, cw, ch = 660, 392, 340, 200
    tx, ty, tw, th = 0, 348, 530, 376
    hub = (680, 290)
    first = ["When the music fades", "All is stripped away", "And I simply come"]

    def link(ax, ay, side):
        # from the hub out to a device, entering it straight on from `side`.
        # Devices below the hub are reached from its bottom, so the line stays
        # clear of the remote's bottom edge.
        hx, hy = hub
        bend = 60
        ex, ey = {"top": (ax, ay - bend), "bottom": (ax, ay + bend), "left": (ax - bend, ay),
                  "right": (ax + bend, ay)}[side]
        if side == "top" and ay > hy + 40:
            sx, sy, c1 = hx, hy + 18, f"{hx} {hy + 66}"
        else:
            sx, sy, c1 = hx, hy, f"{hx + (ax - hx) * 0.4:.0f} {hy}"
        return (f'<path class="scene-link" d="M{sx} {sy}C{c1} {ex} {ey} {ax} {ay}" '
                f'stroke="{ACCENT}" stroke-opacity=".75" stroke-width="1.5" stroke-dasharray="4 6" '
                'stroke-linecap="round" fill="none"/>')

    anchors = [(rx + rw, ry + rh * 0.75, "right"), (mx + mw * 0.3, my + mh, "bottom"), (cx + cw * 0.78, cy, "top"),
               (tx + tw * 0.6, ty, "top")]
    (how_title, how), (bml_title, bml) = demo_songs()[:2]
    body = ["".join(link(*a) for a in anchors),
            label(rx, ry - 10, "Tech PC / tablet / phone"),
            label(mx, my - 10, "Main screen"),
            f'<rect x="{mx}" y="{my}" width="{mw}" height="{mh}" rx="6" fill="{BEZEL}" stroke="{LINE}"/>'
            + live_slide(mx + 5, my + 5, mw - 10, mh - 10, "hero-main", 17, first, deck=deck_slides(DECK)),
            label(cx, cy - 10, "Confidence monitor"),
            confidence("hero", cx, cy, cw, ch, hooks=True,
                       now_svg=lambda x, y, w, h: live_slide(x, y, w, h, "cm-now", 8, first, video=False,
                                                             deck=deck_slides(DECK)),
                       next_lines=FIRST_NEXT, next_deck=deck_slides(DECK)),
            label(tx, ty - 10, "Musician's tablet", cls="tablet-label"),
            turn_chip(tx + 142, ty - 10, "Pastor in control", "#E4572E"),
            chord_tablet(tx, ty, tw, th, [("how", how_title, "D", how), ("bml", bml_title, "G", bml)],
                         extra=pastor_view(tx + 8, ty + 8, tw - 16, th - 16, deck_slides(DECK))),
            wifi_dots([a[:2] for a in anchors]),
            wifi_hub(*hub)]
    return frame("hero", w, h, "".join(body),
                 "The tech team's PC, tablet or phone, the main screen, a confidence monitor and a musician's tablet, all on the same Wi-Fi",
                 card=False)


def hero_mobile():
    """The hero's product shot on phones, where the remote sits full width above
    it: the Wi-Fi hub just under the remote, then each screen full width down a
    dashed line on the left. The tablet is upright, so the song is one column
    that scrolls to the lines on screen.
    Same hooks as hero(), so src/scripts/hero-remote.ts drives both."""
    w = 360
    x, dw = 22, 338
    hub = (180, 40)
    first = ["When the music fades", "All is stripped away", "And I simply come"]
    my, mh = 92, 190
    cy, ch = my + mh + 46, 176
    ty, th = cy + ch + 46, 480
    (how_title, how), (bml_title, bml) = demo_songs()[:2]
    tablet = chord_tablet(x, ty, dw, th, [("how", how_title, "D", how), ("bml", bml_title, "G", bml)],
                          fs=8.5, cols=1, scroll_id="herom-cs",
                          extra=pastor_view(x + 8, ty + 8, dw - 16, th - 16, deck_slides(DECK), portrait=True))
    h = ty + th + 2
    hx, hy = hub
    spine = 8

    def link(ay):
        # out of the hub's left end, down the spine and into the device's edge
        return (f'<path class="scene-link" d="M{hx - 46} {hy}C{spine} {hy} {spine} {hy} {spine} {hy + 40}'
                f'L{spine} {ay - 12}Q{spine} {ay} {x} {ay}" stroke="{ACCENT}" stroke-opacity=".75" stroke-width="1.5" '
                'stroke-dasharray="4 6" stroke-linecap="round" fill="none"/>')

    anchors = [(x, my + 30), (x, cy + 30), (x, ty + 30)]
    body = [f'<path class="scene-link" d="M{hx} 0V{hy - 18}" stroke="{ACCENT}" stroke-opacity=".75" stroke-width="1.5" '
            'stroke-dasharray="4 6" stroke-linecap="round" fill="none"/>',
            "".join(link(ay) for _, ay in anchors),
            label(x, my - 10, "Main screen"),
            f'<rect x="{x}" y="{my}" width="{dw}" height="{mh}" rx="6" fill="{BEZEL}" stroke="{LINE}"/>'
            + live_slide(x + 5, my + 5, dw - 10, mh - 10, "hero-main", 15, first, deck=deck_slides(DECK)),
            label(x, cy - 10, "Confidence monitor"),
            confidence("herom", x, cy, dw, ch, hooks=True,
                       now_svg=lambda x, y, w, h: live_slide(x, y, w, h, "cm-now", 8.5, first, video=False,
                                                             deck=deck_slides(DECK)),
                       next_lines=FIRST_NEXT, next_deck=deck_slides(DECK)),
            label(x, ty - 10, "Musician's tablet", cls="tablet-label"),
            turn_chip(x + 142, ty - 10, "Pastor in control", "#E4572E"),
            tablet,
            wifi_dots(anchors),
            wifi_hub(*hub)]
    return frame("herom", w, h, "".join(body),
                 "The main screen, a confidence monitor and a musician's tablet, all on the same Wi-Fi as the remote",
                 card=False)


def edit_anywhere():
    """Step 1 of "Prepare at home, together": three houses at night, each with
    someone editing from a lit window, all linked to the one service. Drawn
    big and simple: it shows at about 240px wide."""
    w, h = 320, 200
    lit = "#F5D58A"
    sky = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#FFFFFF" fill-opacity=".45"/>'
                  for x, y, r in ((18, 20, 1), (54, 50, .8), (80, 14, .9), (250, 58, .8), (302, 16, 1), (232, 14, .8)))
    moon = (f'<circle cx="284" cy="34" r="11" fill="{lit}" fill-opacity=".85"/>'
            f'<circle cx="289" cy="30" r="10" fill="{CANVAS}"/>')
    # the service everyone is editing
    rows = (("#E4572E", 70), ("#D98A1C", 52), ("#6C5CE7", 78))
    card = (f'<g transform="translate(96 10)"><rect width="128" height="64" rx="7" fill="{SURFACE}" stroke="{LINE}"/>'
            f'<text x="10" y="18" font-size="10" font-weight="700" fill="{INK}">Sunday service</text>'
            + "".join(f'<rect x="10" y="{28 + i * 11}" width="7" height="7" rx="1.5" fill="{c}"/>'
                      f'<rect x="22" y="{30 + i * 11}" width="{wd}" height="3.5" rx="1.75" fill="{SUB}" fill-opacity=".7"/>'
                      for i, (c, wd) in enumerate(rows))
            + '</g>')
    ground = 190

    def house(x, wd, ht, roof, win):
        # win: the lit window (x offset, y offset) the person is working at,
        # with a dark one across from it
        wx, wy = win
        return (f'<path d="M{x} {ground}V{ground - ht}L{x + wd / 2} {ground - ht - roof}L{x + wd} {ground - ht}V{ground}Z" '
                f'fill="#2C2E35" stroke="{LINE}"/>'
                f'<rect x="{x + wd - wx - 20}" y="{ground - ht + wy}" width="20" height="17" rx="2" fill="{BEZEL}"/>'
                f'<rect x="{x + wx}" y="{ground - ht + wy}" width="20" height="17" rx="2" fill="{lit}"/>')

    def cursor(x, y, color, name):
        tw = text_width(name, 9.5) + 12
        return (f'<path d="M{x} {y}l13 6.5-5.5 1.4-3 5.9z" fill="{color}" stroke="#FFFFFF" stroke-width="1.3" '
                f'stroke-linejoin="round"/>'
                f'<rect x="{x + 10}" y="{y + 11}" width="{tw:.0f}" height="16" rx="4" fill="{color}"/>'
                f'<text x="{x + 16}" y="{y + 22.5}" font-size="9.5" font-weight="700" fill="#FFFFFF">{name}</text>')

    # (x, width, wall height, roof height, lit window) and who is at that window
    houses = [(10, 90, 52, 30, (12, 6)), (118, 84, 70, 24, (12, 12)), (222, 84, 48, 32, (12, 4))]
    names = [("#E4572E", "Pastor Dan"), ("#D98A1C", "Grace"), ("#6C5CE7", "James")]
    tops = [(x + wd / 2, ground - ht - roof) for x, wd, ht, roof, _ in houses]
    links = "".join(f'<path class="scene-link" d="M{tx:.0f} {ty}C{tx:.0f} {ty - 24} 160 98 160 74" stroke="{ACCENT}" '
                    'stroke-opacity=".75" stroke-width="1.4" stroke-dasharray="3 5" stroke-linecap="round" fill="none"/>'
                    for tx, ty in tops)
    # each cursor points at the bottom right corner of its lit window
    people = "".join(cursor(x + wx + 18, ground - ht + wy + 15, *who)
                     for (x, wd, ht, roof, (wx, wy)), who in zip(houses, names))
    body = (f'<rect width="{w}" height="{h}" fill="{CANVAS}"/>{sky}{moon}{links}{card}'
            + "".join(house(*hh) for hh in houses)
            + f'<line x1="0" y1="{ground}" x2="{w}" y2="{ground}" stroke="{LINE}"/>'
            + wifi_dots(tops) + people)
    return frame("edit", w, h, body, "Three people editing the same Sunday service from their own homes", card=False)


if __name__ == "__main__":
    import json
    import sys

    if "--deck-html" in sys.argv:
        # for tools/remote-screenshots.mjs: the slides as the remote's
        # thumbnails show them, before the pastor marks them up
        print(json.dumps([deck_slide(i, {k: v for k, v in s.items() if k != "ink"}) for i, s in enumerate(DECK)]))
        sys.exit()
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "src", "assets", "illustrations")
    for name, build in (("hero-devices", hero), ("hero-devices-mobile", hero_mobile), ("edit-anywhere", edit_anywhere)):
        path = os.path.join(out, f"{name}.svg")
        with open(path, "w", encoding="utf-8") as f:
            f.write(build() + "\n")
        print(f"wrote {os.path.normpath(path)}")
