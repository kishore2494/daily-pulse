#!/usr/bin/env python3
"""Generate the social share card (og-card.png, 1200x630).

Why this exists
---------------
128 landing pages declared `twitter:card = summary_large_image` and supplied no image at all.
That is worse than declaring nothing: the card type is a promise of a wide image, and every
share of every page was cashing it with a blank. The only images in the repo were 512x512
launcher icons, which is the wrong shape for the card that was being asked for.

So the card is generated rather than hand-made, and generated from the assets and palette the
app already uses (icons/icon-512.png, the gradient from tools/feature-graphic.html). Running
this again reproduces the same file, which is what lets tools/check-release.mjs treat its
dimensions as a fact rather than a hope.

    python3 tools/make-og-card.py          # writes og-card.png
    python3 tools/make-og-card.py --check  # verify only, exit 1 if wrong/missing
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "og-card.png"
ICON = ROOT / "icons" / "icon-512.png"

W, H = 1200, 630            # the size summary_large_image and og:image both want
BG = (7, 11, 20)            # #070b14, the app's background
TEAL = (74, 214, 192)       # #4ad6c0
BLUE = (109, 140, 255)      # #6d8cff
VIOLET = (143, 123, 255)    # #8f7bff

TITLE = "Daylog"
TAGLINE = "Private, offline life tracker"
LINE3 = "Habits · Mood · Time · Gym · Journal · Focus"

FONTS = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/SFNS.ttf",
]
FONTS_REG = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/SFNS.ttf",
]


def font(paths, size):
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    # Never crash the release over a font: a card with the default face still beats no card.
    return ImageFont.load_default()


def radial(shape, cx, cy, rx, ry, colour, strength):
    """One soft radial glow, matching the three in tools/feature-graphic.html."""
    h, w = shape
    ys, xs = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2)
    a = np.clip(1.0 - d, 0.0, 1.0) ** 2 * strength
    return np.dstack([a * c for c in colour])


def build():
    # Gradients are computed at quarter scale and resized up: they are smooth by construction,
    # so nothing is lost, and it turns a multi-second pixel loop into an instant one.
    sw, sh = W // 4, H // 4
    base = np.zeros((sh, sw, 3), dtype=float)
    base[:, :] = BG
    base += radial((sh, sw), sw * 0.88, sh * 0.15, sw * 0.70, sh * 0.90, TEAL, 0.16)
    base += radial((sh, sw), sw * 0.08, sh * 0.85, sw * 0.60, sh * 0.80, BLUE, 0.20)
    base += radial((sh, sw), sw * 0.50, sh * -0.10, sw * 0.50, sh * 0.60, VIOLET, 0.14)
    small = Image.fromarray(np.clip(base, 0, 255).astype("uint8"))
    img = small.resize((W, H), Image.LANCZOS)

    # The launcher icon. icon-512.png is RGB with no alpha and its rounded corners are painted
    # WHITE, so pasting it straight onto the dark card puts a white square around the mark —
    # which is how the first render of this card came out. Re-cut the same corner radius as a
    # mask instead: measured at 98/512 of the icon's own artwork, not guessed.
    if ICON.exists():
        size = 260
        icon = Image.open(ICON).convert("RGBA").resize((size, size), Image.LANCZOS)
        mask = Image.new("L", (size, size), 0)
        # Inset by 2px: the artwork's rounded edge is antialiased AGAINST the white backing,
        # so the outermost ring of pixels is part white and leaves a hairline halo otherwise.
        ImageDraw.Draw(mask).rounded_rectangle(
            [2, 2, size - 3, size - 3], radius=round(size * 98 / 512), fill=255)
        img.paste(icon, (96, (H - size) // 2), mask)

    d = ImageDraw.Draw(img)
    x = 96 + 260 + 64
    d.text((x, 214), TITLE, font=font(FONTS, 104), fill=(255, 255, 255))
    d.text((x, 336), TAGLINE, font=font(FONTS_REG, 40), fill=(214, 226, 240))
    d.text((x, 396), LINE3, font=font(FONTS_REG, 26), fill=(140, 160, 186))

    # A thin brand rule, so the card reads as designed rather than as a screenshot.
    d.rectangle([96, H - 74, 96 + 168, H - 68], fill=TEAL)
    return img


def check():
    if not OUT.exists():
        print(f"!! {OUT.name} is missing — run: python3 tools/make-og-card.py")
        return 1
    w, h = Image.open(OUT).size
    if (w, h) != (W, H):
        print(f"!! {OUT.name} is {w}x{h}, expected {W}x{H}")
        return 1
    print(f"og card: {OUT.name} {w}x{h}, {OUT.stat().st_size // 1024} kB")
    return 0


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(check())
    build().save(OUT, optimize=True)
    sys.exit(check())
