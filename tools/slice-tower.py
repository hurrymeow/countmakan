#!/usr/bin/env python3
"""Prepare the tower shop sprites for img/tower/shops/.

The Gemini sheets (tools/art-src/tower-shops-{1,2,3}.png) were cut on a magenta key into
one PNG per piece. This script takes that folder of cut pieces (default: the project art
folder), removes the magenta fringe, clamps the lobby height, and writes optimised PNGs.

  python3 tools/slice-tower.py [cut-pieces-dir]
"""
import sys, pathlib
from PIL import Image

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/art/tower-shops')
OUT = pathlib.Path(__file__).resolve().parent.parent / 'img' / 'tower' / 'shops'
KEEP = ['bakery', 'boxing', 'butch', 'deli', 'dojo', 'fish', 'noodle', 'nut', 'office', 'pizza', 'pool', 'sport']
PIECES = [f'{k}-{p}' for k in KEEP for p in ('edge', 'sig', 'mid')]
PIECES += ['mess-ceiling', 'mess-clutter', 'mess-tape', 'roof-wide', 'lobby-wide', 'slab', 'sky', 'garden']
PIECES += [f'p-{n}' for n in ('gym', 'kid', 'off1', 'off2', 'off3', 'old1', 'old2', 'rider', 'shop1', 'shop2', 'shop3')]
LOBBY_H = 162  # about 1.5 floors


def despill(im):
    """Pull magenta out of pixels that touch transparency, and fix their alpha."""
    w, h = im.size
    px = im.load()
    a = [[px[x, y][3] for x in range(w)] for y in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b, al = px[x, y]
            if al == 0:
                continue
            edge = any(
                0 <= x + dx < w and 0 <= y + dy < h and a[y + dy][x + dx] < 255
                for dx in range(-2, 3) for dy in range(-2, 3)
            ) or x in (0, w - 1) or y in (0, h - 1)
            if edge and r > g + 24 and b > g + 24:
                m = (r + b) // 2
                k = max(g, int(g + (m - g) * 0.15))
                px[x, y] = (min(r, k), g, min(b, k), al)
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.png'):
        old.unlink()
    for name in PIECES:
        im = Image.open(SRC / f'{name}.png').convert('RGBA')
        if name == 'lobby-wide' and im.height > LOBBY_H:
            im = im.crop((0, im.height - LOBBY_H, im.width, im.height))
        if name != 'sky':
            im = despill(im)
        if name == 'sky':
            im.convert('RGB').quantize(128).save(OUT / f'{name}.png', optimize=True)
        else:
            im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(OUT / f'{name}.png', optimize=True)
    print(f'{len(PIECES)} sprites -> {OUT}')


main()
