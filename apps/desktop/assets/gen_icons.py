"""
Generate all Signoff Chat desktop icon assets.

Outputs:
  icon.png              512×512  app icon (Linux + electron-builder source)
  icon.ico              Windows  multi-size ICO (256/128/64/48/32/16)
  tray-template.png     18×18    macOS template tray icon (black on transparent)
  tray-template@2x.png  36×36    macOS template tray icon @2x
  tray-base.png         18×18    tray base for status-dot compositing (amber dot)
  iconset/              macOS iconset → converted to icon.icns by iconutil

Design:
  App icon  — dark rounded square (#0d0d0b), amber speech-bubble with white "S"
  Tray      — minimal speech-bubble silhouette
"""

import os
import math
import subprocess
import shutil
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

BG       = (13,  13,  11,  255)   # #0d0d0b
AMBER    = (245, 197,  66,  255)   # #f5c542
WHITE    = (255, 255, 255, 255)
BLACK    = (0,   0,   0,   255)
TRANSP   = (0,   0,   0,   0)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.ellipse([x0, y0, x0 + radius*2, y0 + radius*2], fill=fill)
    draw.ellipse([x1 - radius*2, y0, x1, y0 + radius*2], fill=fill)
    draw.ellipse([x0, y1 - radius*2, x0 + radius*2, y1], fill=fill)
    draw.ellipse([x1 - radius*2, y1 - radius*2, x1, y1], fill=fill)


def speech_bubble(draw, cx, cy, w, h, tail_size, fill, radius=None):
    """Draw a speech bubble centred at (cx, cy) with a bottom-left tail."""
    if radius is None:
        radius = h // 5
    x0 = cx - w // 2
    y0 = cy - h // 2
    x1 = cx + w // 2
    # bubble body (bottom edge raised to leave room for tail)
    body_bottom = cy + h // 2 - tail_size
    rounded_rect(draw, [x0, y0, x1, body_bottom], radius, fill)
    # tail — small downward triangle at bottom-left
    tx = x0 + radius
    tail_pts = [
        (tx,              body_bottom),
        (tx + tail_size,  body_bottom),
        (tx,              body_bottom + tail_size),
    ]
    draw.polygon(tail_pts, fill=fill)


# ---------------------------------------------------------------------------
# App icon  (512×512)
# ---------------------------------------------------------------------------

def make_app_icon(size=512):
    img  = Image.new("RGBA", (size, size), TRANSP)
    draw = ImageDraw.Draw(img)

    pad    = int(size * 0.04)
    radius = int(size * 0.22)
    rounded_rect(draw, [pad, pad, size - pad, size - pad], radius, BG)

    # Speech bubble
    bw = int(size * 0.58)
    bh = int(size * 0.46)
    tail = int(size * 0.10)
    speech_bubble(draw, size // 2, int(size * 0.46), bw, bh, tail, AMBER,
                  radius=int(bh * 0.22))

    # "S" in the bubble
    letter_size = int(size * 0.28)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                                   letter_size)
    except Exception:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), "S", font=font)
    tw   = bbox[2] - bbox[0]
    th   = bbox[3] - bbox[1]
    # Centre "S" in the bubble body (above the tail)
    tx = size // 2 - tw // 2
    ty = int(size * 0.46) - int(size * 0.23 * 0.5) - th // 2 - bbox[1]
    draw.text((tx, ty), "S", font=font, fill=WHITE)

    return img


# ---------------------------------------------------------------------------
# Tray icons
# ---------------------------------------------------------------------------

def make_tray_template(size=18):
    """Black speech bubble on transparent — macOS template image."""
    img  = Image.new("RGBA", (size, size), TRANSP)
    draw = ImageDraw.Draw(img)

    pad  = 1
    bw   = size - pad * 2
    bh   = int(size * 0.70)
    tail = int(size * 0.18)
    cx   = size // 2
    cy   = int(size * 0.42)
    speech_bubble(draw, cx, cy, bw, bh, tail, BLACK,
                  radius=max(2, bh // 5))
    return img


def make_tray_base(size=18):
    """
    Same speech-bubble shape in amber — used as the base image onto which
    tray.ts composites a coloured status dot at runtime.
    """
    img  = Image.new("RGBA", (size, size), TRANSP)
    draw = ImageDraw.Draw(img)

    pad  = 1
    bw   = size - pad * 2
    bh   = int(size * 0.70)
    tail = int(size * 0.18)
    cx   = size // 2
    cy   = int(size * 0.42)
    speech_bubble(draw, cx, cy, bw, bh, tail, AMBER,
                  radius=max(2, bh // 5))
    return img


# ---------------------------------------------------------------------------
# macOS iconset → .icns
# ---------------------------------------------------------------------------

ICNS_SIZES = [16, 32, 64, 128, 256, 512]

def make_icns(source_512: Image.Image):
    iconset_dir = os.path.join(SCRIPT_DIR, "icon.iconset")
    os.makedirs(iconset_dir, exist_ok=True)

    for s in ICNS_SIZES:
        resized = source_512.resize((s, s), Image.LANCZOS)
        resized.save(os.path.join(iconset_dir, f"icon_{s}x{s}.png"))
        # @2x variant
        resized2x = source_512.resize((s * 2, s * 2), Image.LANCZOS)
        resized2x.save(os.path.join(iconset_dir, f"icon_{s}x{s}@2x.png"))

    icns_path = os.path.join(SCRIPT_DIR, "icon.icns")
    result = subprocess.run(
        ["iconutil", "-c", "icns", "-o", icns_path, iconset_dir],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  iconutil error: {result.stderr}")
    else:
        print(f"  icon.icns  ✓")

    shutil.rmtree(iconset_dir)


# ---------------------------------------------------------------------------
# Windows .ico (multi-size)
# ---------------------------------------------------------------------------

ICO_SIZES = [(256,256),(128,128),(64,64),(48,48),(32,32),(16,16)]

def make_ico(source_512: Image.Image):
    frames = [source_512.resize(s, Image.LANCZOS).convert("RGBA")
              for s in ICO_SIZES]
    ico_path = os.path.join(SCRIPT_DIR, "icon.ico")
    frames[0].save(ico_path, format="ICO", sizes=ICO_SIZES,
                   append_images=frames[1:])
    print(f"  icon.ico   ✓")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Generating Signoff Chat desktop assets…\n")

    # App icon
    app_icon = make_app_icon(512)
    app_icon.save(os.path.join(SCRIPT_DIR, "icon.png"))
    print("  icon.png   ✓  (512×512)")

    # macOS .icns
    make_icns(app_icon)

    # Windows .ico
    make_ico(app_icon)

    # Tray — template (1x + 2x)
    tpl_1x = make_tray_template(18)
    tpl_1x.save(os.path.join(SCRIPT_DIR, "tray-template.png"))
    print("  tray-template.png    ✓  (18×18)")

    tpl_2x = make_tray_template(36)
    tpl_2x.save(os.path.join(SCRIPT_DIR, "tray-template@2x.png"))
    print("  tray-template@2x.png ✓  (36×36)")

    # Tray base (for status dot compositing)
    base = make_tray_base(18)
    base.save(os.path.join(SCRIPT_DIR, "tray-base.png"))
    print("  tray-base.png        ✓  (18×18)")

    print("\nDone.")


if __name__ == "__main__":
    main()
