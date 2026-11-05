# Turns a signage-illustration.mjs draft into the final transparent PNG:
# swaps the placeholder colours for real content (magenta = TV or laptop
# screen, cyan = the tablet's thumbnails, read row by row), then removes the
# white background. Scenes not in SCENES (the other devices) only get the
# background removed.
#
#   python3 tools/signage-compose.py <draft> <scene> <out.webp> [photo|key]
#
# "photo" is for photoreal device shots on an off-white studio backdrop;
# "key" for ones shot on a solid magenta chroma-key backdrop.
#
# Run from apps/homepage.
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

IMG = "src/assets/images/signage"
SCENES = {
    "kids": {
        "tv": "everybodys-welcome.jpg",
        "thumbs": [
            "everybodys-welcome-angel.jpg",
            "everybodys-welcome.jpg",
            "everybodys-welcome-peter.jpg",
            "everybodys-welcome-peter-2.jpg",
            "everybodys-welcome-host.jpg",
            "everybodys-welcome-star.jpg",
        ],
    },
    # A phone (left) and a tablet (right): one list per device
    "lobby": {
        "tv": "lobby-welcome-home.jpg",
        "thumbs": [
            [
                "lobby-sunday-worship.jpg",
                "lobby-welcome-home.jpg",
                "lobby-todays-theme.jpg",
            ],
            [
                "lobby-sunday-worship.jpg",
                "lobby-welcome-home.jpg",
                "lobby-todays-theme.jpg",
                "lobby-progress-over-perfection.jpg",
                "lobby-not-meant-to-do-this-alone.jpg",
                "lobby-see-you-next-time.jpg",
            ],
        ],
    },
    # Screen off: a solid colour instead of a frame
    "laptop": {"tv": (22, 23, 26)},
}


def regions(rgb, test, n):
    """The n largest connected areas matching a colour test, as masks."""
    labels, count = ndimage.label(test(rgb))
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
    keep = np.argsort(sizes)[::-1][:n] + 1
    # Grow a little to swallow the anti-aliased rim
    return [ndimage.binary_dilation(labels == k, iterations=2) for k in keep]


def cover(img, w, h):
    """Resize and centre-crop to fill w×h."""
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def bbox(mask):
    ys, xs = np.nonzero(mask)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def paste_into(canvas, mask, content, box=None):
    x0, y0, x1, y1 = box or bbox(mask)
    tile = cover(content, x1 - x0, y1 - y0)
    layer = Image.new("RGB", canvas.size)
    layer.paste(tile, (x0, y0))
    canvas.paste(layer, (0, 0), Image.fromarray((mask * 255).astype(np.uint8)))


def main(draft, scene_name, out, mode=""):
    scene = SCENES.get(scene_name, {})
    img = Image.open(draft).convert("RGB")
    rgb = np.asarray(img).astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    if "tv" in scene:
        paste_screen(img, (r > 170) & (g < 120) & (b > 170), scene["tv"])
    if "thumbs" in scene:
        groups = scene["thumbs"] if isinstance(scene["thumbs"][0], list) else [scene["thumbs"]]
        cyan = regions(rgb, lambda _: (r < 130) & (g > 180) & (b > 180), sum(map(len, groups)))
        # Split into devices left to right at the widest horizontal gaps
        cx = [bbox(m)[0] for m in cyan]
        order = sorted(range(len(cyan)), key=lambda i: cx[i])
        gaps = sorted(range(1, len(order)), key=lambda k: cx[order[k]] - cx[order[k - 1]])[::-1][: len(groups) - 1]
        cuts = [0, *sorted(gaps), len(order)]
        for gi, files in enumerate(groups):
            paste_thumbs(img, [cyan[i] for i in order[cuts[gi] : cuts[gi + 1]]], files)
    # Twice the largest size the page shows them at
    limit = 1000 if scene_name in ("kids", "lobby") else 600
    {"photo": cutout_photo, "key": cutout_key}.get(mode, cutout)(img, out, limit)


def cutout_key(img, out, limit, near=40, far=110):
    """Chroma-key cutout for a solid magenta backdrop: alpha from the
    distance to the key colour, then un-mix the key from edge pixels."""
    rgb = np.asarray(img).astype(float)
    edge = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3), rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    key = np.median(edge, axis=0)
    dist = np.linalg.norm(rgb - key, axis=2)
    alpha = np.clip((dist - near) / (far - near), 0, 1)
    # Keep only what's connected to the object, not stray specks
    labels, _ = ndimage.label(alpha > 0.5)
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, labels.max() + 1))
    keep = np.isin(labels, np.nonzero(sizes > sizes.max() * 0.02)[0] + 1)
    alpha[~ndimage.binary_dilation(keep, iterations=2)] = 0
    a3 = alpha[..., None]
    fg = np.where(a3 > 0.01, (rgb - (1 - a3) * key) / np.maximum(a3, 1e-3), 0)
    # Magenta spill shows up as reflections everywhere, not just at the edge.
    # Where both red and blue rise above green, pull both fully back to it
    # (taking only the shared part leaves a red cast). None of the devices
    # are genuinely pink or purple.
    r_, g_, b_ = fg[..., 0].copy(), fg[..., 1], fg[..., 2].copy()
    pink = (r_ > g_) & (b_ > g_)
    fg[..., 0] = np.where(pink, np.minimum(r_, g_ + 3), r_)
    fg[..., 2] = np.where(pink, np.minimum(b_, g_ + 3), b_)
    rgba = np.dstack([np.clip(fg, 0, 255), alpha * 255]).astype(np.uint8)
    out_img = Image.fromarray(rgba, "RGBA")
    out_img = out_img.crop(Image.fromarray((alpha > 0.08).astype(np.uint8) * 255).getbbox())
    out_img.thumbnail((limit, limit), Image.LANCZOS)
    out_img.save(out, optimize=True, quality=90, method=6)
    print(out, out_img.size)


def cutout_photo(img, out, limit, near=16, far=26):
    """Remove a near-uniform background: pixels within `near` of the border
    colour (and connected to the border) go transparent, fading to opaque
    by `far`. Faint shadows fade out with them."""
    rgb = np.asarray(img).astype(float)
    edge = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3), rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    # Local background colour from background pixels only, so a gradient
    # backdrop is followed without the object bleeding into it
    rough = np.linalg.norm(rgb - np.median(edge, axis=0), axis=2) < 30
    lab, _ = ndimage.label(rough)
    ends = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    w = np.isin(lab, ends[ends > 0]).astype(float)
    wsum = np.maximum(ndimage.gaussian_filter(w, 40), 1e-6)
    bgcol = np.dstack([ndimage.gaussian_filter(rgb[..., c] * w, 40) / wsum for c in range(3)])
    dist = np.linalg.norm(rgb - bgcol, axis=2)
    close = dist < far
    labels, _ = ndimage.label(close)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg_region = np.isin(labels, border[border > 0])
    alpha = np.ones(dist.shape)
    ramp = np.clip((dist - near) / (far - near), 0, 1)
    alpha[bg_region] = ramp[bg_region]
    # On a light backdrop, grey pixels lighter than it next to the cut are a
    # floor reflection, not the object
    lum, bglum = rgb.mean(axis=2), bgcol.mean(axis=2)
    if bglum.mean() > 200:
        sat = rgb.max(axis=2) - rgb.min(axis=2)
        glare = (lum > bglum - 4) & (sat < 18) & ndimage.binary_dilation(bg_region, iterations=8)
        alpha[glare] = 0
    # Choke the edge a touch so no backdrop-coloured fringe is left; no blur,
    # so edges stay as crisp as the rest of the page
    alpha = np.clip((alpha - 0.25) / 0.75, 0, 1)
    if bglum.mean() > 200:
        # A thin light rim where the object meets the floor reads as a halo
        # on a dark page
        edge_band = ndimage.binary_dilation(alpha < 0.5, iterations=3)
        alpha[edge_band & (lum > 150) & (sat < 25)] = 0
    a3 = alpha[..., None]
    fg = np.where(a3 > 0.01, (rgb - (1 - a3) * bgcol) / np.maximum(a3, 1e-3), 0)
    rgba = np.dstack([np.clip(fg, 0, 255), alpha * 255]).astype(np.uint8)
    out_img = Image.fromarray(rgba, "RGBA")
    out_img = out_img.crop(Image.fromarray((alpha > 0.08).astype(np.uint8) * 255).getbbox())
    out_img.thumbnail((limit, limit), Image.LANCZOS)
    out_img.save(out, optimize=True, quality=90, method=6)
    print(out, out_img.size)


def paste_screen(img, is_magenta, tv_file):
    magenta = regions(is_magenta, lambda m: m, 1)[0]
    # Bits of screen cut off by the phone still sit inside the TV's box
    ys, xs = np.nonzero(magenta)
    in_box = np.zeros_like(magenta)
    in_box[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1] = True
    stray = ndimage.binary_dilation(is_magenta & in_box & ~magenta, iterations=2)

    tv = (
        Image.new("RGB", (16, 9), tv_file)
        if isinstance(tv_file, tuple)
        else Image.open(f"{IMG}/{tv_file}").convert("RGB")
    )
    paste_into(img, magenta, tv)
    if stray.any():
        # Same placement as the main screen, shown only through the strays
        x0, y0 = xs.min(), ys.min()
        tile = cover(tv, xs.max() - x0 + 1, ys.max() - y0 + 1)
        layer = Image.new("RGB", img.size)
        layer.paste(tile, (x0, y0))
        img.paste(layer, (0, 0), Image.fromarray((stray * 255).astype(np.uint8)))


def paste_thumbs(img, cyan, thumbs):
    # Slots share one size; a thumb over a slot shrinks its box, so use the
    # largest and anchor at the top-left. The thumb stays on top via the mask.
    boxes = [bbox(m) for m in cyan]
    sw = max(b[2] - b[0] for b in boxes)
    sh = max(b[3] - b[1] for b in boxes)
    rows = sorted(range(len(cyan)), key=lambda i: (round(boxes[i][1] / (sh / 2)), boxes[i][0]))
    for i, f in zip(rows, thumbs):
        x0, y0 = boxes[i][:2]
        paste_into(img, cyan[i], Image.open(f"{IMG}/{f}").convert("RGB"), (x0, y0, x0 + sw, y0 + sh))


def cutout(img, out, limit):
    # Background: near-white areas touching the border become transparent;
    # the rim next to them gets partial alpha so outlines stay smooth.
    rgb = np.asarray(img).astype(float).copy()
    # Some drafts come with a thin frame drawn round the edge; ignore it
    rgb[:4], rgb[-4:], rgb[:, :4], rgb[:, -4:] = 255, 255, 255, 255
    light = rgb.min(axis=2) > 232
    labels, _ = ndimage.label(light)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, border[border > 0])
    rim = ndimage.binary_dilation(bg, iterations=1) & ~bg
    alpha = np.where(bg, 0.0, 1.0)
    lum = rgb.mean(axis=2)
    a_rim = np.clip((255 - lum) / (255 - 60), 0.05, 1)
    alpha[rim] = a_rim[rim]
    # Un-mix the white the rim was blended with
    a3 = alpha[..., None]
    fg = np.where(a3 > 0, (rgb - (1 - a3) * 255) / np.maximum(a3, 1e-3), 0)
    rgba = np.dstack([np.clip(fg, 0, 255), alpha * 255]).astype(np.uint8)

    out_img = Image.fromarray(rgba, "RGBA")
    out_img = out_img.crop(out_img.getbbox())
    out_img.thumbnail((limit, limit), Image.LANCZOS)
    out_img.save(out, optimize=True, quality=90, method=6)
    print(out, out_img.size)


if __name__ == "__main__":
    main(*sys.argv[1:5])
