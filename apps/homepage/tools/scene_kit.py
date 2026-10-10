"""Drawing kit for the homepage drawings (tools/sunday-scenes.py): the hero's
screens, tablets and live slides, and the step 1 houses. Flat device frames on
a dark canvas with Wi-Fi links; the product carries it.

Helpers that create an id take a prefix so ids stay unique on the page.
"""

CANVAS = "#1A1B1F"
LINE = "#3A3B41"
SURFACE = "#232429"
BEZEL = "#0B0B0C"
ACCENT = "#3ABAB4"
INK, SUB = "#EDEDEF", "#9B9CA3"


def frame(p, w, h, body, title, card=True, view=None):
    """The scene's SVG. card=False drops the rounded panel behind it; view
    (x, y, w, h) crops the viewBox to part of the canvas."""
    vb = " ".join(str(v) for v in (view or (0, 0, w, h)))
    head = (f'<svg viewBox="{vb}" xmlns="http://www.w3.org/2000/svg" font-family="inherit" role="img" '
            f'aria-labelledby="{p}-title"><title id="{p}-title">{title}</title>')
    if not card:
        return head + body + '</svg>'
    return (head +
            f'<defs><clipPath id="{p}-frame"><rect width="{w}" height="{h}" rx="20"/></clipPath></defs>'
            f'<g clip-path="url(#{p}-frame)"><rect width="{w}" height="{h}" fill="{CANVAS}"/>{body}</g>'
            f'<rect x=".5" y=".5" width="{w - 1}" height="{h - 1}" rx="19.5" fill="none" stroke="#FFFFFF" '
            'stroke-opacity=".08"/></svg>')


def confidence(p, x, y, w, h, now="__SLIDE__", next_lines=("Longing just", "to bring", "something", "of worth"),
               timer="08:42", hooks=False, now_svg=None, next_deck=None):
    """The confidence monitor's screen: the live slide, what's next and a timer.
    hooks=True tags the slide image and next text (cm-now, cm-next) so a script
    can update them. now_svg(x, y, w, h), if given, draws the live slide instead
    of an image. next_deck (deck_slides() html), if given, makes NEXT an HTML
    block filling the right side: the next lyric as wrapping text (cm-next-text)
    or, in slides mode, the whole next slide (a deck one ahead, data-offset 1)."""
    now_cls = ' class="cm-now"' if hooks else ""
    next_cls = ' class="cm-next"' if hooks else ""
    pad = 5
    ix, iy, iw, ih = x + pad + 8, y + pad + 22, (w - 2 * pad) * 0.5, (w - 2 * pad) * 0.5 * 9 / 16
    nx = ix + iw + 12
    cid = f"{p}-cm"
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{BEZEL}" stroke="{LINE}"/>'
            f'<rect x="{x + pad}" y="{y + pad}" width="{w - 2 * pad}" height="{h - 2 * pad}" rx="3" fill="#000"/>'
            f'<text x="{ix}" y="{iy - 7}" font-size="8.5" font-weight="700" letter-spacing="1" fill="{SUB}">NOW</text>'
            + (now_svg(ix, iy, iw, ih) if now_svg else
            f'<clipPath id="{cid}"><rect x="{ix}" y="{iy}" width="{iw:.1f}" height="{ih:.1f}" rx="2"/></clipPath>'
            f'<image{now_cls} href="{now}" x="{ix}" y="{iy}" width="{iw:.1f}" height="{ih:.1f}" '
            f'preserveAspectRatio="xMidYMid slice" clip-path="url(#{cid})"/>')
            + f'<text x="{nx:.1f}" y="{iy - 7}" font-size="8.5" font-weight="700" letter-spacing="1" fill="{SUB}">NEXT</text>'
            + (next_block(nx, iy, x + w - pad - 8 - nx, y + h - pad - 36 - iy, next_lines, next_deck) if next_deck is not None else
               f'<text{next_cls} font-size="10.5" font-weight="600" fill="#FFFFFF">'
               + "".join(f'<tspan x="{nx:.1f}" y="{iy + 10 + i * 14}">{t}</tspan>' for i, t in enumerate(next_lines))
               + '</text>')
            + f'<text x="{ix}" y="{y + h - pad - 10}" font-size="20" font-weight="700" fill="#FFFFFF" '
            f'font-variant-numeric="tabular-nums">{timer}</text>'
            f'<text x="{x + w - pad - 10}" y="{y + h - pad - 11}" text-anchor="end" font-size="11" font-weight="600" '
            f'fill="{SUB}">10:42 am</text>')


def next_block(x, y, w, h, lines, deck):
    """The confidence monitor's NEXT as HTML (see confidence(next_deck=))."""
    sh = w * 9 / 16
    return (f'<foreignObject x="{x:.1f}" y="{y}" width="{w:.1f}" height="{h:.1f}">'
            '<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%">'
            '<div class="cm-next-text" style="color:#fff;font-weight:600;font-size:10px;line-height:1.3">'
            + "<br/>".join(lines) + '</div>'
            f'<div class="deck cm-next-deck" data-offset="1" style="position:relative;width:100%;height:{sh:.1f}px;'
            'overflow:hidden;background:#111">'
            '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;'
            f'font-size:8px;color:{SUB}">End of slides</div>{deck}</div></div></foreignObject>')


def wifi_dots(anchors):
    return "".join(f'<circle cx="{a[0]:.1f}" cy="{a[1]:.1f}" r="3.5" fill="{ACCENT}"/>' for a in anchors)


def wifi_hub(x, y):
    return (f'<g transform="translate({x} {y})">'
            f'<rect x="-46" y="-18" width="92" height="36" rx="18" fill="{BEZEL}" stroke="{LINE}"/>'
            f'<g transform="translate(-22 2)" fill="none" stroke="{ACCENT}" stroke-width="2.2" stroke-linecap="round">'
            '<path d="M-9 -4a13 13 0 0 1 18 0"/><path d="M-5 0a7 7 0 0 1 10 0"/></g>'
            f'<circle cx="-22" cy="6" r="2" fill="{ACCENT}"/>'
            f'<text x="10" y="5" text-anchor="middle" font-size="14" font-weight="600" fill="{INK}">Wi-Fi</text></g>')


def live_slide(x, y, w, h, cls, font, lines, video=True, deck=""):
    """A slide drawn live: the song's motion background with the lyric text on
    top, as HTML inside a foreignObject so the background can be a <video>.
    Backgrounds come from the __BG_<SONG>__ / __POSTER_<SONG>__ placeholders;
    videos don't preload: the poster shows until the hero script plays one, so
    only the song on screen in the visible drawing is ever downloaded.
    the hero script swaps the lyric and which background shows. deck is the
    sermon slides (deck_slides()), shown instead in slides mode."""
    if video:
        bgs = "".join(
            f'<video class="live-bg{"" if i == 0 else " is-hidden"}" data-song="{song}" src="__BG_{song.upper()}__" '
            f'poster="__POSTER_{song.upper()}__" muted="" loop="" playsinline="" preload="none"></video>'
            for i, song in enumerate(("how", "bml")))
    else:
        bgs = "".join(
            f'<img class="live-bg{"" if i == 0 else " is-hidden"}" data-song="{song}" src="__POSTER_{song.upper()}__" alt=""/>'
            for i, song in enumerate(("how", "bml")))
    text = "<br/>".join(lines)
    return (f'<foreignObject x="{x}" y="{y}" width="{w}" height="{h}" class="{cls}">'
            f'<div xmlns="http://www.w3.org/1999/xhtml" class="live-slide">{bgs}'
            f'<div class="live-lyric" style="font-size:{font}px">{text}</div>{deck}</div></foreignObject>')


def label(x, y, text, anchor="start", cls=None):
    """A small caps name above a device."""
    c = f' class="{cls}"' if cls else ""
    return (f'<text{c} x="{x}" y="{y}" text-anchor="{anchor}" font-size="11" font-weight="700" letter-spacing="1.2" '
            f'fill="{SUB}">{text.upper()}</text>')


def chord_tablet(x, y, w, h, songs, fs=8.5, cols=2, scroll_id=None, extra=""):
    """A musician's chord sheet on a tablet: black background, chords above the
    lyrics, with a bar beside the lines on screen. Two columns fit the whole
    song on a landscape tablet. One column
    with scroll_id set is an upright tablet that clips the song and scrolls it:
    each song's lines sit in a cs-scroll group and carry data-y so a script can
    bring the highlighted lines into view. h=None sizes the tablet to the
    longest song and returns (svg, h). Everything on screen sits in a
    tablet-chords group; extra (another view, e.g. pastor_view) goes beside it. Each song is its own group (cs-song); each lyric line is tagged
    with data-line (counted from 0, lyric lines only) so a script can highlight
    the lines on screen. songs: [(key, title, music_key, content)] with content
    in ChordPro."""
    import re

    pad, top, gap = 8, 30, 22
    sx, sy, sw = x + pad, y + pad, w - 2 * pad
    cw = fs * 0.6   # monospace character width
    chord_h, lyric_h, head_h = fs + 2, fs + 4, fs + 8
    groups, bottom = [], 0
    for n, (key, title, music_key, content) in enumerate(songs):
        # sections: [name, [(chords, lyric)]]
        sections = []
        for raw in content.split("\n"):
            m = re.fullmatch(r"\[([^\]]+)\]", raw.strip())
            if m:
                sections.append([m.group(1), []])
                continue
            if raw in ("-", ""):
                continue
            lyric, chords, col = "", [], 0
            for part in re.split(r"(\[[^\]]+\])", raw):
                if part.startswith("[") and part.endswith("]"):
                    chords.append((col, part[1:-1]))
                else:
                    lyric += part
                    col += len(part)
            sections[-1][1].append((chords, lyric.lstrip()))
        height = lambda secs: sum(head_h + sum((chord_h if c else 0) + lyric_h for c, _ in ls) + 8 for _, ls in secs)
        # split the sections into two columns as evenly as possible
        k = min(range(1, len(sections)), key=lambda k: max(height(sections[:k]), height(sections[k:])))
        columns = [sections[:k], sections[k:]] if cols == 2 else [sections]
        col_w = max(len(l) for _, ls in columns[0] for _, l in ls) * cw + gap
        rows, line = [], 0
        for c, secs in enumerate(columns):
            cx, cy = sx + 14 + c * col_w, sy + top + 6
            for name, ls in secs:
                rows.append(f'<text x="{cx}" y="{cy + fs:.1f}" font-size="{fs - 1.5}" font-weight="700" '
                            f'letter-spacing="1" fill="#6B7280">{name.upper()}</text>')
                cy += head_h
                for chords, lyric in ls:
                    # the bar on the left marks the lines on screen; bars on
                    # neighbouring lines meet, so a slide's lines get one bar
                    tall = (chord_h if chords else 0) + lyric_h
                    g = [f'<g class="cs-line" data-line="{line}" data-y="{cy - sy - top:.0f}">'
                         f'<rect class="cs-bar" x="{cx - 9}" y="{cy + 1:.1f}" width="3" height="{tall + .5:.1f}"/>']
                    if chords:
                        g.append("".join(f'<text class="cs-chord" x="{cx + col * cw:.1f}" y="{cy + fs:.1f}">{name}</text>'
                                         for col, name in chords))
                        cy += chord_h
                    g.append(f'<text class="cs-lyric" x="{cx}" y="{cy + fs:.1f}">{lyric}</text></g>')
                    rows.append("".join(g))
                    cy += lyric_h
                    line += 1
                cy += 8
            bottom = max(bottom, cy)
        groups.append(f'<g class="cs-song{"" if n == 0 else " is-hidden"}" data-song="{key}" data-title="{title}" '
                      f'data-key="{music_key}"><g class="cs-scroll">{"".join(rows)}</g></g>')
    sized = h is None
    if sized:
        h = bottom - y + pad + 4
    out = [f'<rect class="tablet-frame" x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{BEZEL}" stroke="{LINE}"/>',
           f'<rect x="{sx}" y="{sy}" width="{sw}" height="{h - 2 * pad}" rx="9" fill="#000"/>',
           '<g class="tablet-chords">']
    clip = ""
    if scroll_id:
        out.append(f'<clipPath id="{scroll_id}"><rect x="{sx}" y="{sy + top}" width="{sw}" height="{h - 2 * pad - top}"/>'
                   '</clipPath>')
        clip = f' clip-path="url(#{scroll_id})"'
    out.append(f'<g font-family="ui-monospace, Menlo, Consolas, monospace" font-size="{fs}"{clip}>{"".join(groups)}</g>')
    first = songs[0]
    out.append(f'<text class="cs-title" x="{sx + 14}" y="{sy + 20}" font-size="12" font-weight="700" fill="#FFFFFF">{first[1]}</text>'
               f'<text class="cs-key" x="{sx + sw - 14}" y="{sy + 20}" text-anchor="end" font-size="10.5" font-weight="600" '
               f'fill="#F5B547">Key {first[2]}</text>'
               f'<line x1="{sx}" y1="{sy + top}" x2="{sx + sw}" y2="{sy + top}" stroke="#FFFFFF" stroke-opacity=".08"/>'
               '</g>' + extra)
    return ("".join(out), h) if sized else "".join(out)


VERSE = 4.8   # scripture text size, cqw

# ink tools as the app draws them: colour, width (of a 160-wide slide) and
# whether it multiplies onto the slide
INK_TOOLS = {"pencil": ("#EF4444", 1.1, False), "highlight": ("#FDE047", 4.8, True)}


def verse_y(line):
    """Middle of a scripture line's lowercase letters, in the slide's 160x90
    box (1cqw = 1.6): the text starts 20.2 down and lines are 1.35 apart."""
    f, lh = VERSE * 1.6, VERSE * 1.6 * 1.35
    return 20.2 + (lh - f) / 2 + f * 0.9 + lh * line - f * 0.32


def verse_x(chars):
    """Roughly where a scripture line's nth character sits (Arial)."""
    return 9.6 + chars * VERSE * 1.6 * 0.44


def deck_slide(i, s):
    """One sermon slide as HTML, styled inline and sized in container units so
    it looks the same at any size: on the screens, the pastor's tablet and the
    remote thumbnails in tools/remote-screenshots.mjs. s: a DECK entry from
    sunday-scenes.py.
    ink=[(tool, [path, ...]), ...] adds the pastor's marks, one layer per tool,
    hidden until the hero script draws them."""
    fg = s.get("fg", "#FFFFFF")
    base = (f'position:absolute;inset:0;container-type:size;overflow:hidden;background:{s["bg"]};color:{fg};'
            'font-family:Arial,Helvetica,sans-serif;')
    centre = "display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;"
    if s["kind"] == "title":
        inner = (f'<div style="font-size:8.5cqw;font-weight:700;line-height:1.1">{s["title"]}</div>'
                 f'<div style="font-size:3.6cqw;margin-top:2.5cqw;opacity:.9">{s["sub"]}</div>')
        style = base + centre
    elif s["kind"] == "heading":
        inner = (f'<div style="font-size:9cqw;font-weight:700">{s["title"]}</div>'
                 '<div style="width:22cqw;height:.9cqw;margin-top:2.5cqw;border-radius:1cqw;background:linear-gradient('
                 '90deg,#FF5A5A,#FFB347,#FFE066,#5AD67D,#4DA3FF,#9B6BFF)"></div>')
        style = base + centre
    else:
        # padding on an inner box: a container's own padding can't use its cqw
        inner = ('<div style="padding:7cqw 6cqw">'
                 f'<div style="font-size:2.6cqw;font-weight:700;letter-spacing:.3cqw;opacity:.85">{s["ref"].upper()}</div>'
                 f'<div style="font-size:{VERSE}cqw;line-height:1.35;margin-top:2.6cqw;white-space:nowrap">'
                 + "<br/>".join(s["lines"]) + '</div></div>')
        style = base
    ink = ""
    if "ink" in s:
        # the pastor's marks, drawn like the app's (src/ink in the slides
        # plugin) in a 160x90 box matching the slide's 16:9. The hero script
        # draws each path in turn with the pastor's cursor tracing it.
        for tool, strokes in s["ink"]:
            colour, width, blend = INK_TOOLS[tool]
            ink += (f'<svg class="ink" data-tool="{tool}" viewBox="0 0 160 90" style="position:absolute;inset:0;'
                    f'width:100%;height:100%{";mix-blend-mode:multiply" if blend else ""}">'
                    + "".join(f'<path pathLength="1" d="{d}" fill="none" stroke="{colour}" stroke-width="{width}" '
                              'stroke-linecap="round" stroke-linejoin="round"/>' for d in strokes)
                    + '</svg>')
    return f'<div class="deck-slide" data-slide="{i}" style="{style}">{inner}{ink}</div>'


def deck_slides(deck):
    return "".join(deck_slide(i, s) for i, s in enumerate(deck))


# Lucide icons the app's speaker view uses (24x24, stroked)
ICONS = {
    "laser": "M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h.01M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5",
    "pencil": "M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5zM15 5l4 4",
    "highlight": "M9 11l-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4",
    "eraser": "M7 21l-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9",
    "grid": "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    "notes": "M4 4h16v12H8l-4 4zM8 8h8M8 12h5",
    "edit": "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
    "pause": "M8 5v14M16 5v14",
    "reset": "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
    "close": "M6 6l12 12M18 6 6 18",
    "prev": "M15 18l-6-6 6-6",
    "next": "M9 18l6-6-6-6",
}


def icon(name, size, color="currentColor"):
    # sized inline: the hero's CSS stretches every svg in the drawing to 100%
    return (f'<svg viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2" stroke-linecap="round" '
            f'stroke-linejoin="round" style="display:block;flex:none;width:{size}px;height:{size}px">'
            f'<path d="{ICONS[name]}"/></svg>')


def cursor_html(color, name, cls, at=(0.7, 0.4)):
    """A Figma-style cursor with a name tag, for the hero script to move. at:
    where it starts, as fractions of its container."""
    return (f'<div class="{cls}" style="position:absolute;left:{at[0] * 100:.0f}%;top:{at[1] * 100:.0f}%;width:0;height:0;'
            'z-index:5">'
            '<span class="pv-click"></span>'
            '<svg viewBox="0 0 24 24" style="position:absolute;left:-2px;top:-2px;width:16px;height:16px;'
            'filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))"><path d="M3 2l17 8.5-7.2 1.8L9 20z" '
            f'fill="{color}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
            f'<span style="position:absolute;left:11px;top:12px;white-space:nowrap;border-radius:3px;padding:1px 5px;'
            f'font-size:8.5px;font-weight:700;color:#fff;background:{color}">{name}</span></div>')


def pastor_view(x, y, w, h, deck, portrait=False):
    """The pastor's tablet, laid over the chord tablet's screen (x, y, w, h)
    and shown instead of it in slides mode (the hero's CSS hides it
    otherwise). Modelled on the app's speaker view
    (plugins/slides/view/Remote/PresenterView): the slide, the ink toolbar
    and slide count under it, previous and next previews, and the speaker
    notes panel with the timer, beside the slide on a landscape tablet and
    under it on an upright one. The hero script fills in the notes, count
    and previews, and drives the pastor's cursor (pv-cursor)."""
    ink = "#212529"
    sub = "#6C757D"
    stroke = "#DEE2E6"

    def frame(offset, empty=""):
        return (f'<div class="deck" data-offset="{offset}" style="position:relative;width:100%;aspect-ratio:16/9;'
                f'overflow:hidden;background:#F1F3F5;box-shadow:inset 0 0 0 1px {stroke}">'
                f'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;'
                f'font-size:7px;color:{sub}">{empty}</div>{deck}</div>')

    def button(name):
        return (f'<span class="pv-tool" data-tool="{name}" style="display:flex;align-items:center;justify-content:center;width:20px;'
                f'height:20px;border-radius:4px">{icon(name, 11)}</span>')

    def preview(offset, label, arrow, num_cls, empty):
        return (f'<div class="pv-preview" style="flex:1;min-width:0">{frame(offset, empty)}'
                f'<div style="display:flex;justify-content:space-between;align-items:center;padding-top:3px;'
                f'font-size:7px;color:{sub}"><span style="display:flex;align-items:center;gap:2px">{icon(arrow, 8)}'
                f'{label}</span><span class="{num_cls}" style="color:#ADB5BD"></span></div></div>')

    pad = 8
    left = (f'<div style="{"" if portrait else "flex:1;"}min-width:0;padding:{pad}px;'
            f'{"padding-top:24px;" if portrait else ""}display:flex;flex-direction:column">'
            f'<div class="pv-main" style="position:relative">{frame(0)}</div>'
            f'<div style="display:flex;align-items:center;gap:2px;margin-top:6px;color:{ink}">'
            + button("laser") + button("pencil") + button("highlight") + button("eraser")
            + f'<span style="margin-left:auto;padding:0 6px">{icon("grid", 10)}</span>'
            f'<span class="pv-count" style="font-size:8px;color:{sub};font-variant-numeric:tabular-nums">1 / 5</span></div>'
            '<div style="display:flex;gap:8px;margin-top:7px">'
            + preview(-1, "Previous", "prev", "pv-prev-n", "Start of slides")
            + preview(1, "Next", "next", "pv-next-n", "End of slides")
            + '</div></div>')
    aside = (f'<div style="{"flex:1;border-top" if portrait else "width:38%;border-left"}:1px solid {stroke};'
             'background:#F8F9FA;display:flex;flex-direction:column;min-height:0">'
             f'<div style="height:26px;flex:none;display:flex;align-items:center;gap:4px;padding:0 {pad + 2}px;'
             f'{"" if portrait else "padding-right:28px;"}border-bottom:1px solid {stroke};font-size:7px;font-weight:600;'
             f'letter-spacing:.06em;text-transform:uppercase;color:{sub}">{icon("notes", 9)}Speaker notes'
             f'<span style="margin-left:auto;display:flex;align-items:center;gap:2px;text-transform:none;letter-spacing:0;'
             f'color:{ink}">{icon("edit", 8)}Edit</span></div>'
             f'<div class="pv-notes" style="flex:1;padding:{pad + 2}px;font-size:9.5px;line-height:1.5;color:{ink}"></div>'
             f'<div style="flex:none;border-top:1px solid {stroke};padding:6px {pad + 2}px;display:flex;align-items:center;'
             'justify-content:space-between"><span style="font-family:ui-monospace,Menlo,Consolas,monospace;'
             f'font-size:19px;color:{ink};font-variant-numeric:tabular-nums">12:40</span>'
             '<span style="display:flex;gap:4px">'
             + "".join(f'<span style="display:flex;width:20px;height:20px;align-items:center;justify-content:center;'
                       f'border:1px solid {stroke};border-radius:4px;background:#fff;color:{ink}">{icon(n, 10)}</span>'
                       for n in ("pause", "reset"))
             + '</span></div></div>')
    close = (f'<span style="position:absolute;right:6px;top:5px;color:{ink}">{icon("close", 11)}</span>')
    return (f'<foreignObject x="{x}" y="{y}" width="{w}" height="{h}" class="tablet-pastor">'
            '<div xmlns="http://www.w3.org/1999/xhtml" class="pv-root" style="position:relative;width:100%;height:100%;'
            f'display:flex;{"flex-direction:column;" if portrait else ""}overflow:hidden;border-radius:9px;background:#fff;'
            f'color:{ink};font-family:\'Noto Sans\',\'Open Sans\',Arial,sans-serif">'
            + left + aside + close
            + cursor_html("#E4572E", "Pastor", "pv-cursor", (0.4, 0.3) if portrait else (0.45, 0.55))
            + '</div></foreignObject>')


def text_width(text, size):
    """Rough width of bold UI text, by letter shape: SVG can't size a pill to
    its label, so name tags and chips use this."""
    em = 0
    for c in text:
        em += (0.30 if c in " iljtfrI" else 0.85 if c in "mwMW" else 0.75 if c in "GCDOQ"
               else 0.66 if c.isupper() else 0.56)
    return em * size


def turn_chip(x, y, text, colour):
    """A pill shown beside a device's label when that person takes over (the
    hero's CSS shows it in pastor-turn), so eyes follow the action."""
    w = text_width(text, 9.5) + 16
    return (f'<g class="turn-chip"><rect x="{x}" y="{y - 12}" width="{w:.0f}" height="17" rx="8.5" fill="{colour}"/>'
            f'<text x="{x + 8}" y="{y}" font-size="9.5" font-weight="700" fill="#FFFFFF">{text}</text></g>')
