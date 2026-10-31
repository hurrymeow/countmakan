#!/usr/bin/env python3
"""Cut the Gemini walk sheets into one sprite strip per walker: img/tower/shops/w-<name>.png.

Sources are tools/art-src/walkers-{1,2}.png: magenta background, a few drawn grid and ground
lines. Each strip holds the chosen frames side by side, all on the same canvas, feet on the
bottom edge, so the page can step through them with CSS. Frame picks were made by eye, because
some frames in the sheets show a different person.

  python3 tools/slice-walkers.py
Prints the cell width and frame count for each strip, which go into js/tower-art.js.
"""
import json
import pathlib
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'art-src'
OUT = ROOT / 'img' / 'tower' / 'shops'
CANVAS_H = 96  # tallest figure, in pixels. Others keep their relative height.

# name: (sheet, band y-range, frame picks in walking order)
WALKERS = {
    'gym': (1, (0, 190), [1, 2, 4, 3]),
    'office': (1, (192, 380), [0, 1, 2, 4]),
    'shopper': (1, (384, 572), [0, 1, 2, 5]),
    'old': (2, (0, 186), [0, 1, 2, 1]),
    'kid': (2, (190, 364), [0, 2]),
    'rider': (2, (368, 560), [0, 1, 3, 5]),
}


def load(path):
    a = np.array(Image.open(path).convert('RGB')).astype(int)
    spill = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    fg = spill < 110
    dark = (a.max(axis=2) < 80) & fg
    for y in range(fg.shape[0]):
        if dark[y].sum() > 180:
            fg[max(0, y - 2):y + 3] = False
    for x in range(fg.shape[1]):
        if dark[:, x].sum() > 150:
            fg[:, max(0, x - 2):x + 3] = False
    return a, fg


def figures(fg, y0, y1):
    cols = fg[y0:y1].sum(axis=0) > 0
    out, start = [], None
    for x, c in enumerate(list(cols) + [False]):
        if c and start is None:
            start = x
        if not c and start is not None:
            if x - start > 12:
                ys = np.where(fg[y0:y1, start:x].sum(axis=1) > 0)[0]
                out.append((start, y0 + ys.min(), x, y0 + ys.max() + 1))
            start = None
    return out


def despill(a, fg):
    """Pull magenta out of edge pixels so no pink fringe shows on the page."""
    edge = np.zeros_like(fg)
    bg = ~fg
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            edge |= np.roll(np.roll(bg, dy, 0), dx, 1)
    spill = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    fix = fg & edge & (spill > 20)
    k = a[..., 1] + (spill * 0.1).astype(int)
    a = a.copy()
    a[..., 0] = np.where(fix, np.minimum(a[..., 0], k), a[..., 0])
    a[..., 2] = np.where(fix, np.minimum(a[..., 2], k), a[..., 2])
    return a


def main():
    sheets = {n: load(SRC / f'walkers-{n}.png') for n in (1, 2)}
    cut = {}
    for name, (sheet, (y0, y1), picks) in WALKERS.items():
        a, fg = sheets[sheet]
        a = despill(a, fg)
        boxes = figures(fg, y0, y1)
        frames = []
        for i in dict.fromkeys(picks):
            x0, ty, x1, by = boxes[i]
            rgba = np.dstack([a[ty:by, x0:x1], fg[ty:by, x0:x1] * 255]).astype('uint8')
            frames.append((i, Image.fromarray(rgba, 'RGBA')))
        cut[name] = (picks, dict(frames))
    tallest = max(f.height for _, fs in cut.values() for f in fs.values())
    scale = CANVAS_H / tallest
    info = {}
    for name, (picks, fs) in cut.items():
        scaled = {i: f.resize((max(1, round(f.width * scale)), max(1, round(f.height * scale))), Image.LANCZOS) for i, f in fs.items()}
        cw = max(f.width for f in scaled.values()) + 2
        strip = Image.new('RGBA', (cw * len(picks), CANVAS_H), (0, 0, 0, 0))
        for k, i in enumerate(picks):
            f = scaled[i]
            strip.paste(f, (k * cw + (cw - f.width) // 2, CANVAS_H - f.height), f)
        strip.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(OUT / f'w-{name}.png', optimize=True)
        info[name] = [cw, len(picks)]
    print(json.dumps(info))


main()
