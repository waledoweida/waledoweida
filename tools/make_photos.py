#!/usr/bin/env python3
"""Make every photo the site uses from one portrait:

  profile.webp / profile.jpg   the hero photo (640x876, the shape of the hero frame)
  avatar.jpg                   the small round photo (header, footer, WhatsApp bubble, articles)
  og.png                       the share image: only the round photo in it is replaced
  apple-touch-icon.png, icon-512.png                square icons (the phone rounds the corners)
  icon-192.png, favicon-32.png, favicon.ico         round icons with the gold ring
  icon-maskable-512.png                             round photo + ring on the site's dark colour

Usage:
  python3 tools/make_photos.py PHOTO --hero X1,Y1,X2,Y2 --face X1,Y1,X2,Y2

  --hero  the part of the photo shown in the hero frame (about 0.73 wide for 1 tall)
  --face  a square around the face, for the avatar, the icons and the share image

Needs Pillow. Writes only those files at the top of the site (never wedding/ or فرح/).
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_blog import safe_path  # noqa: E402

HERO_SIZE = (640, 876)
GOLD = (230, 201, 131)
INK = (11, 13, 18)
# where the round photo sits in og.png (measured from its gold ring)
OG_CENTER, OG_RADIUS, OG_RING = (989.5, 314.5), 116, 4
SS = 4  # supersampling for smooth circle edges


def box(text):
    vals = [int(v) for v in text.split(",")]
    if len(vals) != 4 or vals[0] >= vals[2] or vals[1] >= vals[3]:
        raise argparse.ArgumentTypeError("expected X1,Y1,X2,Y2")
    return tuple(vals)


def circle_mask(size, radius, center=None):
    """Anti-aliased round mask (L mode) of `size`, filled inside `radius`."""
    w, h = size
    cx, cy = center or (w / 2, h / 2)
    big = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(big).ellipse(
        [(cx - radius) * SS, (cy - radius) * SS, (cx + radius) * SS, (cy + radius) * SS], fill=255)
    return big.resize(size, Image.LANCZOS)


def face_at(face, d):
    return face.resize((d, d), Image.LANCZOS)


def round_icon(face, size, ring, background=None, radius=None):
    """Round photo with a gold ring; transparent around it unless `background` is given."""
    radius = radius or size / 2
    canvas = Image.new("RGBA", (size, size), background + (255,) if background else (0, 0, 0, 0))
    gold = Image.new("RGBA", (size, size), GOLD + (255,))
    canvas.paste(gold, (0, 0), circle_mask((size, size), radius))
    inner = radius - ring
    d = round(inner * 2)
    photo = face_at(face, d).convert("RGBA")
    off = round(size / 2 - inner)
    canvas.paste(photo, (off, off), circle_mask((d, d), inner))
    return canvas


def save(img, path, **kw):
    img.save(safe_path(path), **kw)
    print(f"  {path}  {img.size[0]}x{img.size[1]}  {os.path.getsize(safe_path(path)) // 1024} KB")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("photo")
    ap.add_argument("--hero", type=box, required=True)
    ap.add_argument("--face", type=box, required=True)
    a = ap.parse_args()

    src = ImageOps.exif_transpose(Image.open(a.photo)).convert("RGB")
    fx1, fy1, fx2, fy2 = a.face
    if fx2 - fx1 != fy2 - fy1:
        sys.exit("--face must be a square")

    # hero: the frame's shape, a little sharpening after the downscale
    hero = src.crop(a.hero).resize(HERO_SIZE, Image.LANCZOS)
    hero = ImageEnhance.Sharpness(hero).enhance(1.15)
    save(hero, "profile.webp", quality=82, method=6)
    save(hero, "profile.jpg", quality=84, optimize=True, progressive=True)

    # small photos: a touch brighter so the face reads at icon size
    face = src.crop(a.face)
    face = ImageEnhance.Brightness(face).enhance(1.08)
    face = ImageEnhance.Contrast(face).enhance(1.05)

    save(face_at(face, 192), "avatar.jpg", quality=88, optimize=True, progressive=True)
    save(face_at(face, 180), "apple-touch-icon.png", optimize=True)
    save(face_at(face, 512), "icon-512.png", optimize=True)
    save(round_icon(face, 192, ring=6), "icon-192.png", optimize=True)
    fav32 = round_icon(face, 32, ring=2)
    save(fav32, "favicon-32.png", optimize=True)
    ico = round_icon(face, 48, ring=2.5)
    ico.save(safe_path("favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    print("  favicon.ico  16+32+48")
    # maskable: everything important inside the central 80% circle (radius 204.8 of 512)
    save(round_icon(face, 512, ring=5, background=INK, radius=205).convert("RGB"), "icon-maskable-512.png", optimize=True)

    # share image: repaint the ring's inside, then the new round photo
    og = Image.open(safe_path("og.png")).convert("RGB")
    cx, cy = OG_CENTER
    gold = Image.new("RGB", og.size, GOLD)
    og.paste(gold, (0, 0), circle_mask(og.size, OG_RADIUS + OG_RING / 2, (cx, cy)))
    d = OG_RADIUS * 2
    left, top = int(cx - OG_RADIUS + 0.5), int(cy - OG_RADIUS + 0.5)   # the photo's first column/row: 874, 199
    og.paste(face_at(face, d), (left, top), circle_mask((d, d), OG_RADIUS, (cx - left, cy - top)))
    save(og, "og.png", optimize=True)


if __name__ == "__main__":
    main()
