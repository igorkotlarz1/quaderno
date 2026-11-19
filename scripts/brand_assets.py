"""Generates the Quadernote brand files: the wordmark "quadernotè" as outlined paths and the app icon.

Writes docs/assets/brand/*.svg, web/public/favicon.svg and scripts/wordmark.json (used by readme_assets.py).
The wordmark is outlined from Archivo ExtraBold (SIL Open Font License), so it looks the same everywhere,
including inside <img> on GitHub where web fonts don't load. The font itself is not committed:

    curl -o /tmp/archivo800.ttf "<Archivo 800 TTF from Google Fonts>"
    python3 scripts/brand_assets.py /tmp/archivo800.ttf      # needs: pip install fonttools
"""

import json
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "docs" / "assets" / "brand"

INK = {"light": "#151515", "dark": "#ecebe6"}
RED = {"light": "#c8321b", "dark": "#ff6b4f"}
TRACKING = -0.035  # em, the same tight spacing as the app's display type


def outline(font_path: Path) -> dict:
    """Return the wordmark in font units (1 em = 1000): one path for "quader", one for "note", the accent."""
    font = TTFont(font_path)
    cmap, glyphs, hmtx = font.getBestCmap(), font.getGlyphSet(), font["hmtx"]
    x = 0.0
    paths = {"quader": "", "note": ""}
    e_left = e_width = 0.0
    for i, ch in enumerate("quadernote"):
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        # font units are y-up; SVG is y-down, baseline at y = 0
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        paths["quader" if i < 6 else "note"] += pen.getCommands()
        adv = hmtx[name][0]
        if i == 9:
            e_left, e_width = x, adv
        x += adv + TRACKING * 1000
    width = x - TRACKING * 1000
    xh = font["OS/2"].sxHeight
    # grave accent, kept low: it starts just above the x-height, not at capital height
    accent = {
        "x1": round(e_left + e_width * 0.30, 1), "y1": round(-xh - 190, 1),
        "x2": round(e_left + e_width * 0.62, 1), "y2": round(-xh - 88, 1),
        "w": 92,
    }
    return {"width": round(width, 1), "ascent": 800, "descent": 120, "xheight": xh, **paths, "accent": accent}


def wordmark_svg(wm: dict, theme: str, height: int = 120, pad: int = 0) -> str:
    """The wordmark at `height` px tall (the viewBox is in font units)."""
    top = -wm["ascent"] - pad
    h = wm["ascent"] + wm["descent"] + 2 * pad
    w = wm["width"] + 2 * pad
    a = wm["accent"]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {top} {w:.0f} {h}" height="{height}" '
        f'width="{height * w / h:.0f}" role="img" aria-label="quadernotè">'
        f'<path d="{wm["quader"]}" fill="{INK[theme]}"/>'
        f'<path d="{wm["note"]}" fill="{RED[theme]}"/>'
        f'<line x1="{a["x1"]}" y1="{a["y1"]}" x2="{a["x2"]}" y2="{a["y2"]}" stroke="{RED[theme]}" '
        f'stroke-width="{a["w"]}" stroke-linecap="round"/></svg>\n'
    )


def cup(small: bool) -> str:
    """Espresso from above in a 100×100 box: white cup with a red rim, the flag poured in latte/foam/espresso."""
    if small:
        return (
            '<circle cx="50" cy="50" r="42" fill="#ffffff" stroke="#c8321b" stroke-width="13"/>'
            '<g clip-path="url(#crema)"><rect x="14" y="14" width="28" height="72" fill="#c49a6c"/>'
            '<rect x="42" y="14" width="17" height="72" fill="#f6ead8"/>'
            '<rect x="59" y="14" width="28" height="72" fill="#5b3a22"/></g>'
        )
    return (
        '<circle cx="50" cy="50" r="43" fill="#ffffff" stroke="#c8321b" stroke-width="10"/>'
        '<g clip-path="url(#crema)"><rect x="14" y="14" width="27" height="72" fill="#c49a6c"/>'
        '<rect x="40" y="14" width="21" height="72" fill="#f6ead8"/>'
        '<rect x="60" y="14" width="27" height="72" fill="#5b3a22"/>'
        '<path d="M41 14 C 37 34, 44 62, 40 86" fill="none" stroke="#f6ead8" stroke-width="3"/>'
        '<path d="M60 14 C 63 38, 57 62, 61 86" fill="none" stroke="#f6ead8" stroke-width="3"/>'
        '<circle cx="50" cy="50" r="33" fill="none" stroke="#3d2614" stroke-opacity="0.35" stroke-width="3"/></g>'
    )


def icon_svg(size: int, small: bool = False) -> str:
    """The app icon: red tile, cream saucer, the flag espresso with a wide handle."""
    defs = (
        '<defs><clipPath id="tile"><rect width="120" height="120" rx="27"/></clipPath>'
        '<clipPath id="crema"><circle cx="50" cy="50" r="33"/></clipPath></defs>'
    )
    if small:
        body = (
            '<rect width="120" height="120" fill="#c8321b"/>'
            '<circle cx="56" cy="58" r="50" fill="#f6ead8"/>'
            '<path d="M82 72 L 100 88" stroke="#ffffff" stroke-width="17" stroke-linecap="round"/>'
            f'<g transform="translate(18 20) scale(0.76)">{cup(True)}</g>'
        )
    else:
        body = (
            '<rect width="120" height="120" fill="#c8321b"/>'
            '<circle cx="58" cy="62" r="49" fill="#9e2614" opacity="0.55"/>'
            '<circle cx="56" cy="58" r="48" fill="#f6ead8"/>'
            '<circle cx="56" cy="58" r="39" fill="none" stroke="#e2cfb1" stroke-width="3"/>'
            '<circle cx="58" cy="61" r="31" fill="#3d2614" opacity="0.18"/>'
            '<path d="M80 70 L 98 86" stroke="#ffffff" stroke-width="13" stroke-linecap="round"/>'
            '<path d="M83 73 L 96 84" stroke="#c8321b" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>'
            f'<g transform="translate(22 24) scale(0.68)">{cup(False)}</g>'
        )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="{size}" height="{size}" '
        f'role="img" aria-label="Quadernote">{defs}<g clip-path="url(#tile)">{body}</g></svg>\n'
    )


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    wm = outline(Path(sys.argv[1]))
    BRAND.mkdir(parents=True, exist_ok=True)
    (ROOT / "scripts" / "wordmark.json").write_text(json.dumps(wm) + "\n", encoding="utf-8")
    for theme in ("light", "dark"):
        (BRAND / f"wordmark-{theme}.svg").write_text(wordmark_svg(wm, theme), encoding="utf-8")
    (BRAND / "icon.svg").write_text(icon_svg(512), encoding="utf-8")
    (BRAND / "icon-small.svg").write_text(icon_svg(64, small=True), encoding="utf-8")
    public = ROOT / "web" / "public"
    public.mkdir(parents=True, exist_ok=True)
    (public / "favicon.svg").write_text(icon_svg(64, small=True), encoding="utf-8")
    print("wrote brand files to", BRAND, "and web/public/favicon.svg")


if __name__ == "__main__":
    main()
