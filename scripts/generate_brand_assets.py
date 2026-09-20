"""Regenerate the raster Holotrace brand assets from the "H" mark.

The mark is defined once here and mirrors the marketing site's `.brand-mark`
geometry (a 22x22 grid: two 6-unit stems, a 12x6 crossbar, 2-unit radii).

Covers the Android adaptive-icon foregrounds and the Windows installer
artwork. The remaining Tauri icons come from `tauri icon`:

    python scripts/generate_brand_assets.py
    bun run tauri icon src-tauri/icons/icon-source.png
    python scripts/generate_brand_assets.py   # re-apply the adaptive foregrounds

Requires Pillow.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

BG = (15, 20, 26)  # --bg
ACCENT = (47, 107, 255)  # --accent
SS = 4  # supersample factor, removed by the final LANCZOS downscale

ROOT = Path(__file__).resolve().parent.parent
ANDROID_RES = ROOT / "src-tauri/gen/android/app/src/main/res"
INSTALLER = ROOT / "src-tauri/installer"

# Android adaptive-icon foreground sizes, in px, keyed by density bucket.
ANDROID_FOREGROUNDS = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def draw_mark(draw: ImageDraw.ImageDraw, ox: float, oy: float, unit: float) -> None:
    """Draw the H mark with its top-left at (ox, oy); `unit` is one grid unit."""

    def bar(x: float, y: float, w: float, h: float) -> None:
        draw.rounded_rectangle(
            [ox + x * unit, oy + y * unit, ox + (x + w) * unit, oy + (y + h) * unit],
            radius=2 * unit,
            fill=ACCENT,
        )

    bar(0, 0, 6, 22)
    bar(16, 0, 6, 22)
    bar(5, 8, 12, 6)


def square_icon(size: int, glyph_ratio: float, background: tuple[int, int, int] | None) -> Image.Image:
    """Square icon with the mark centred; `background` None leaves it transparent."""
    im = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    if background is not None:
        # 0.2227 matches the squircle radius used by the SVG icon (114/512).
        draw.rounded_rectangle(
            [0, 0, size * SS - 1, size * SS - 1], radius=0.2227 * size * SS, fill=background + (255,)
        )
    glyph = size * SS * glyph_ratio
    draw_mark(draw, (size * SS - glyph) / 2, (size * SS - glyph) / 2, glyph / 22)
    return im.resize((size, size), Image.LANCZOS)


def plate(width: int, height: int, glyph: int, cx: float, cy: float, path: Path) -> None:
    """Brand-dark BMP with the mark centred on (cx, cy), given as plate fractions."""
    im = Image.new("RGB", (width * SS, height * SS), BG)
    draw = ImageDraw.Draw(im)
    g = glyph * SS
    draw_mark(draw, cx * width * SS - g / 2, cy * height * SS - g / 2, g / 22)
    im.resize((width, height), Image.LANCZOS).save(path)


def main() -> None:
    # Source image for `tauri icon`.
    square_icon(1024, glyph_ratio=0.5625, background=BG).save(ROOT / "src-tauri/icons/icon-source.png")

    # Android adaptive foregrounds: transparent, sized to stay inside the mask's
    # safe zone. `tauri icon` writes full-bleed icons here, which get cropped.
    for bucket, size in ANDROID_FOREGROUNDS.items():
        square_icon(size, glyph_ratio=0.45, background=None).save(
            ANDROID_RES / f"mipmap-{bucket}/ic_launcher_foreground.png"
        )

    # Windows installer artwork, at the sizes NSIS and WiX expect.
    INSTALLER.mkdir(exist_ok=True)
    plate(150, 57, 34, 0.5, 0.5, INSTALLER / "nsis-header.bmp")
    plate(164, 314, 84, 0.5, 0.3, INSTALLER / "nsis-sidebar.bmp")
    plate(493, 58, 34, 0.9, 0.5, INSTALLER / "wix-banner.bmp")
    plate(493, 312, 96, 0.19, 0.45, INSTALLER / "wix-dialog.bmp")


if __name__ == "__main__":
    main()
