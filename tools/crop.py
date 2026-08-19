#!/usr/bin/env python3
"""Crop a full-page browse screenshot down to one phone viewport.
browse captures the FULL page, so fixed elements (topbar, bottom nav) render at
their document position, not pinned. The caller hides them and passes the Y offset
of the element it actually wants."""
import sys
from PIL import Image
src, dst, y, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
im = Image.open(src).convert('RGB')
sx = im.width / w                     # device pixel ratio the shot came back at
W, H = im.width, int(round(h * sx))
Y = int(round(y * sx))
if Y + H > im.height:
    Y = max(0, im.height - H)
im.crop((0, Y, W, min(Y + H, im.height))).resize((w, h), Image.LANCZOS).save(dst)
print('%s  %dx%d  (from y=%d)' % (dst, w, h, y))
