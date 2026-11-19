"""Generates the animated SVGs used by README.md (docs/assets/*-dark.svg and *-light.svg).

Pure SVG + SMIL, no scripts and no web fonts, so GitHub renders them inside <img>.
Run from the repo root:  python3 scripts/readme_assets.py
"""

import json
from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).resolve().parents[1] / "docs" / "assets"

DISPLAY = "'Archivo','Arial Narrow','Helvetica Neue',Arial,sans-serif"
UI = "'Schibsted Grotesk','Segoe UI','Helvetica Neue',Arial,sans-serif"
MONO = "'IBM Plex Mono','JetBrains Mono','SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace"

# Same tokens as web/src/styles.css, plus the flag colours.
THEMES = {
    "dark": dict(
        paper="#131413", sheet="#1a1b1a", ink="#ecebe6", muted="#a19f97", line="#2f312e", quad="#232523",
        red="#ff6b4f", red_soft="#3a1e17", ok="#6fcf9b", card="#202220", shadow="#000000",
        verde="#2fa866", bianco="#f4f2ea", rosso="#e0474f", cup="#ecebe6", coffee="#8a5a3c",
    ),
    "light": dict(
        paper="#f3f4f1", sheet="#fbfbf9", ink="#151515", muted="#62645f", line="#d9dbd5", quad="#e7e9e3",
        red="#c8321b", red_soft="#f7e3dd", ok="#1d6b45", card="#ffffff", shadow="#151515",
        verde="#009246", bianco="#ffffff", rosso="#ce2b37", cup="#151515", coffee="#6f4127",
    ),
}

CYCLE = 14  # seconds, one loop of the header story


def t(x, y, text, size, fill, family=UI, weight=400, anchor="start", extra=""):
    return (
        f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" '
        f'fill="{fill}" text-anchor="{anchor}" {extra}>{escape(text)}</text>'
    )


def wordmark(c, x, baseline, size):
    """The outlined "quadernotè" wordmark (scripts/wordmark.json, made by brand_assets.py), font size in px."""
    wm = json.loads((Path(__file__).with_name("wordmark.json")).read_text(encoding="utf-8"))
    a, k = wm["accent"], size / 1000
    return (
        f'<g transform="translate({x} {baseline}) scale({k})">'
        f'<path d="{wm["quader"]}" fill="{c["ink"]}"/><path d="{wm["note"]}" fill="{c["red"]}"/>'
        f'<line x1="{a["x1"]}" y1="{a["y1"]}" x2="{a["x2"]}" y2="{a["y2"]}" stroke="{c["red"]}" '
        f'stroke-width="{a["w"]}" stroke-linecap="round"/></g>'
    )


def frame(w, h, c, body, label):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{escape(label)}">
  <defs>
    <pattern id="quad" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="{c["quad"]}" stroke-width="1"/>
    </pattern>
    <clipPath id="frame"><rect width="{w}" height="{h}" rx="18"/></clipPath>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="{c["shadow"]}" flood-opacity="0.18"/>
    </filter>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="{w}" height="{h}" fill="{c["sheet"]}"/>
    <rect width="{w}" height="{h}" fill="url(#quad)"/>
{body}
  </g>
  <rect x="0.75" y="0.75" width="{w - 1.5}" height="{h - 1.5}" rx="17.5" fill="none" stroke="{c["line"]}" stroke-width="1.5"/>
</svg>
"""


def tricolore_strip(c, y, w, h=6):
    third = w / 3
    return (
        f'<rect x="0" y="{y}" width="{third:.1f}" height="{h}" fill="{c["verde"]}"/>'
        f'<rect x="{third:.1f}" y="{y}" width="{third:.1f}" height="{h}" fill="{c["bianco"]}"/>'
        f'<rect x="{2 * third:.1f}" y="{y}" width="{third:.1f}" height="{h}" fill="{c["rosso"]}"/>'
    )


def keyed(values, times):
    """SMIL helper: values/keyTimes strings for a {CYCLE}s loop."""
    return f'values="{";".join(map(str, values))}" keyTimes="{";".join(f"{k:.3f}" for k in times)}"'


def reveal_clip(cid, x, y, w, h, start, end, hold=0.9):
    """A clip rect whose width types the text in between `start` and `end` (fractions of the cycle)."""
    vals = keyed([0, 0, w, w, 0, 0], [0, start, end, hold, hold + 0.03, 1])
    return (
        f'<clipPath id="{cid}"><rect x="{x}" y="{y}" width="0" height="{h}">'
        f'<animate attributeName="width" {vals} dur="{CYCLE}s" repeatCount="indefinite"/></rect></clipPath>'
    )


def fade(start, end=0.9, out=0.93):
    """Opacity animation: invisible, fades in at `start`, visible until `end`, gone at `out`."""
    s2 = min(start + 0.02, end)
    return (
        f'<animate attributeName="opacity" {keyed([0, 0, 1, 1, 0, 0], [0, start, s2, end, out, 1])} '
        f'dur="{CYCLE}s" repeatCount="indefinite"/>'
    )


# ---------------------------------------------------------------- header


def header(c):
    W, H = 1200, 480
    parts = []

    # notebook margin (double red line) and the flag strip on top
    parts.append(f'<line x1="98" y1="0" x2="98" y2="{H}" stroke="{c["red"]}" stroke-opacity="0.55" stroke-width="1.5"/>')
    parts.append(f'<line x1="103" y1="0" x2="103" y2="{H}" stroke="{c["red"]}" stroke-opacity="0.3" stroke-width="1"/>')
    parts.append(tricolore_strip(c, 0, W, 5))

    # hanging bookmark ribbon in the flag colours, swaying
    parts.append(
        f"""<g>
      <animateTransform attributeName="transform" type="rotate" values="-2.2 1131 0;2.2 1131 0;-2.2 1131 0" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
      <path d="M1110 0H1152V128L1131 112L1110 128Z" fill="{c["bianco"]}" stroke="{c["line"]}" stroke-width="1"/>
      <path d="M1110 0H1124V118.7L1110 128Z" fill="{c["verde"]}"/>
      <path d="M1138 0H1152V128L1138 118.7Z" fill="{c["rosso"]}"/>
    </g>"""
    )

    # page holes on the far left, like a ring notebook
    for y in (70, 235, 400):
        parts.append(f'<circle cx="48" cy="{y}" r="9" fill="{c["paper"]}" stroke="{c["line"]}" stroke-width="1.5"/>')

    # kicker, title, subtitle
    parts.append(t(132, 64, "IL MIO QUADERNO D’ITALIANO  ·  A1 → B1", 14, c["red"], MONO, 600, extra='letter-spacing="2.5"'))
    parts.append(wordmark(c, 128, 146, 96))
    parts.append(
        t(132, 184, "Type fast during the lesson. Let AI tidy it up after. Watch your level fill up.", 19, c["muted"], UI)
    )

    # espresso cup with steam, right after the title
    cx, cy = 724, 116
    steam = []
    for i, dx in enumerate((-10, 0, 10)):
        steam.append(
            f'<path d="M{cx + dx} {cy - 22} c -6 -8 6 -14 0 -22 c -6 -8 6 -14 0 -20" fill="none" stroke="{c["muted"]}" '
            f'stroke-width="2.2" stroke-linecap="round" opacity="0">'
            f'<animate attributeName="opacity" values="0;0.75;0" dur="3s" begin="{i * 0.9}s" repeatCount="indefinite"/>'
            f'<animateTransform attributeName="transform" type="translate" values="0 6;0 -8" dur="3s" begin="{i * 0.9}s" repeatCount="indefinite"/>'
            f"</path>"
        )
    parts.append("".join(steam))
    parts.append(
        f'<path d="M{cx - 24} {cy - 16} H{cx + 24} V{cy + 4} a24 20 0 0 1 -48 0 Z" fill="{c["sheet"]}" stroke="{c["cup"]}" stroke-width="2.4"/>'
        f'<path d="M{cx - 21} {cy - 12} H{cx + 21}" stroke="{c["coffee"]}" stroke-width="5" stroke-linecap="round"/>'
        f'<path d="M{cx + 24} {cy - 8} c 14 0 14 18 0 18" fill="none" stroke="{c["cup"]}" stroke-width="2.4"/>'
        f'<ellipse cx="{cx}" cy="{cy + 27}" rx="36" ry="5" fill="none" stroke="{c["cup"]}" stroke-width="2.4"/>'
    )

    # the notebook sheet: three rows typed Italian → Polish
    defs = []
    sx, sy = 132, 214
    parts.append(f'<rect x="{sx - 14}" y="{sy - 16}" width="600" height="168" rx="10" fill="{c["card"]}" stroke="{c["line"]}" filter="url(#soft)"/>')
    parts.append(t(sx, sy + 6, "WŁOSKI", 11, c["muted"], MONO, 600, extra='letter-spacing="1.5"'))
    parts.append(t(sx + 300, sy + 6, "POLSKI", 11, c["muted"], MONO, 600, extra='letter-spacing="1.5"'))
    rows_y = [sy + 44, sy + 88, sy + 132]
    for y in rows_y:
        parts.append(f'<line x1="{sx}" y1="{y + 10}" x2="{sx + 270}" y2="{y + 10}" stroke="{c["line"]}" stroke-width="1.5"/>')
        parts.append(f'<line x1="{sx + 300}" y1="{y + 10}" x2="{sx + 570}" y2="{y + 10}" stroke="{c["line"]}" stroke-width="1.5"/>')

    def typed(cid, x, y, text, start, end, color, weight=500, size=21):
        w = int(len(text) * size * 0.62) + 8
        defs.append(reveal_clip(cid, x - 2, y - size, w, size + 10, start, end))
        return f'<g clip-path="url(#{cid})">{t(x, y, text, size, color, MONO, weight)}</g>'

    # row 1: la finestra → okno
    parts.append(typed("r1a", sx, rows_y[0], "la finestra", 0.03, 0.12, c["ink"]))
    parts.append(typed("r1b", sx + 300, rows_y[0], "okno", 0.14, 0.18, c["ink"]))
    # row 2: il tavolo → NULL, later filled by the AI
    parts.append(typed("r2a", sx, rows_y[1], "il tavolo", 0.21, 0.29, c["ink"]))
    y2 = rows_y[1]
    parts.append(
        f'<g opacity="0">{fade(0.31, 0.6, 0.62)}'
        f'<rect x="{sx + 300}" y="{y2 - 19}" width="190" height="26" rx="13" fill="{c["red_soft"]}"/>'
        f"{t(sx + 314, y2 - 1, 'NULL · brak tłumaczenia', 12.5, c['red'], MONO, 600)}</g>"
    )
    parts.append(
        f'<g opacity="0">{fade(0.64)}{t(sx + 300, y2, "stół", 21, c["ink"], MONO, 500)}'
        f'<rect x="{sx + 360}" y="{y2 - 17}" width="54" height="22" rx="11" fill="none" stroke="{c["ok"]}" stroke-width="1.5"/>'
        f"{t(sx + 387, y2 - 1.5, '✦ AI', 12, c['ok'], MONO, 700, 'middle')}</g>"
    )
    # row 3: caffe` turns into caffè as you type
    y3 = rows_y[2]
    parts.append(typed("r3a", sx, y3, "caffe`", 0.38, 0.46, c["ink"]))
    # the backtick version is hidden by a sheet-coloured patch when the accent kicks in
    parts.append(
        f'<g opacity="0">{fade(0.5)}<rect x="{sx - 4}" y="{y3 - 24}" width="100" height="32" fill="{c["card"]}"/>'
        f"{t(sx, y3, 'caff', 21, c['ink'], MONO, 500)}"
        f'<text x="{sx + 52}" y="{y3}" font-family="{MONO}" font-size="21" font-weight="700" fill="{c["red"]}">è'
        f'<animate attributeName="font-size" {keyed([21, 21, 28, 21, 21], [0, 0.5, 0.53, 0.57, 1])} dur="{CYCLE}s" repeatCount="indefinite"/></text></g>'
    )
    parts.append(typed("r3b", sx + 300, y3, "kawa", 0.55, 0.6, c["ink"]))
    # blinking caret that hops between fields
    caret_x = [sx, sx + 140, sx + 300, sx + 360, sx, sx + 116, sx + 420, sx, sx + 80, sx + 300, sx + 360]
    caret_y = [rows_y[0]] * 4 + [rows_y[1]] * 3 + [rows_y[2]] * 4
    ct = [0, 0.12, 0.13, 0.18, 0.2, 0.29, 0.31, 0.37, 0.46, 0.54, 0.6]
    parts.append(
        f'<rect width="2.5" height="24" fill="{c["red"]}">'
        f'<animate attributeName="x" values="{";".join(str(x) for x in caret_x)}" keyTimes="{";".join(f"{k:.3f}" for k in ct)}" calcMode="discrete" dur="{CYCLE}s" repeatCount="indefinite"/>'
        f'<animate attributeName="y" values="{";".join(str(y - 20) for y in caret_y)}" keyTimes="{";".join(f"{k:.3f}" for k in ct)}" calcMode="discrete" dur="{CYCLE}s" repeatCount="indefinite"/>'
        f'<animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></rect>'
    )
    parts.append(t(sx + 572, sy + 6, "Enter ↵", 11, c["muted"], MONO, 500, "end"))

    # verb card: covers open one by one
    vx, vy, vw = 770, 214, 310
    parts.append(f'<rect x="{vx}" y="{vy - 16}" width="{vw}" height="168" rx="10" fill="{c["card"]}" stroke="{c["line"]}" filter="url(#soft)"/>')
    parts.append(t(vx + 16, vy + 10, "parlare", 20, c["ink"], MONO, 700))
    parts.append(t(vx + 112, vy + 10, "· mówić", 15, c["muted"], UI))
    parts.append(
        f'<rect x="{vx + vw - 86}" y="{vy - 6}" width="70" height="20" rx="10" fill="none" stroke="{c["muted"]}" stroke-width="1"/>'
        + t(vx + vw - 51, vy + 8, "presente", 11, c["muted"], MONO, 500, "middle")
    )
    people = [("io", "parlo"), ("tu", "parli"), ("lui/lei", "parla"), ("noi", "parliamo"), ("voi", "parlate"), ("loro", "parlano")]
    cw, ch = 140, 34
    for i, (p, form) in enumerate(people):
        col, row = i % 2, i // 2
        x = vx + 16 + col * (cw + 6)
        y = vy + 28 + row * (ch + 6)
        start = 0.66 + i * 0.035
        parts.append(f'<rect x="{x}" y="{y}" width="{cw}" height="{ch}" rx="6" fill="none" stroke="{c["line"]}"/>')
        parts.append(t(x + 10, y + 22, p, 12, c["muted"], MONO, 500))
        parts.append(t(x + cw - 10, y + 23, form, 16, c["ink"], MONO, 600, "end"))
        # the red cover slides up and fades
        parts.append(
            f'<g><rect x="{x}" y="{y}" width="{cw}" height="{ch}" rx="6" fill="{c["red_soft"]}"/>'
            f"{t(x + cw / 2, y + 22, p, 13, c['red'], MONO, 600, 'middle')}"
            f'<animate attributeName="opacity" {keyed([1, 1, 0, 0, 1, 1], [0, start, start + 0.02, 0.9, 0.93, 1])} dur="{CYCLE}s" repeatCount="indefinite"/></g>'
        )

    # level vial
    lx, ly, lw, lh = 132, 414, 948, 22
    levels = ["A1", "A1+", "A2", "A2+", "B1"]
    parts.append(t(lx, ly - 12, "LIVELLO", 11, c["muted"], MONO, 600, extra='letter-spacing="1.5"'))
    for i, lv in enumerate(levels):
        x = lx + lw * (i + 0.5) / 5
        parts.append(t(x, ly - 12, lv, 12, c["red"] if i == 1 else c["muted"], MONO, 700 if i == 1 else 500, "middle"))
    parts.append(f'<rect x="{lx}" y="{ly}" width="{lw}" height="{lh}" rx="11" fill="{c["paper"]}" stroke="{c["ink"]}" stroke-width="1.5"/>')
    for i in range(1, 5):
        x = lx + lw * i / 5
        parts.append(f'<line x1="{x}" y1="{ly + 5}" x2="{x}" y2="{ly + lh - 5}" stroke="{c["line"]}" stroke-width="1.5"/>')
    fill_w = lw * 0.29 - 6
    parts.append(
        f'<rect x="{lx + 3}" y="{ly + 3}" width="16" height="{lh - 6}" rx="8" fill="{c["red"]}">'
        f'<animate attributeName="width" {keyed([16, 16, fill_w, fill_w, 16, 16], [0, 0.72, 0.86, 0.95, 0.99, 1])} dur="{CYCLE}s" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;0.3 0 0.2 1;0 0 1 1;0.4 0 0.6 1;0 0 1 1"/></rect>'
    )
    parts.append(t(lx + lw, ly + lh + 20, "estimated by AI every week", 11, c["muted"], MONO, 500, "end"))

    body = "<defs>" + "".join(defs) + "</defs>\n" + "\n".join("    " + p for p in parts)
    return frame(W, H, c, body, "Quadernotè: a personal Italian notebook. Italian words typed in class, AI fills the gaps, verbs reveal their forms, the CEFR level fills a vial.")


# ---------------------------------------------------------------- architecture


def box(c, x, y, w, h, kicker, title, lines, accent=None, dashed=False, pulse_begin=None):
    stroke = accent or c["line"]
    dash = ' stroke-dasharray="6 5"' if dashed else ""
    anim = ""
    if pulse_begin is not None:
        anim = f'<animate attributeName="stroke-opacity" values="0.5;1;0.5" dur="4s" begin="{pulse_begin}s" repeatCount="indefinite"/>'
    out = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{c["card"]}" stroke="{stroke}" stroke-width="1.6"{dash} filter="url(#soft)">{anim}</rect>',
        t(x + 16, y + 26, kicker, 11, accent or c["muted"], MONO, 600, extra='letter-spacing="1.5"'),
        t(x + 16, y + 52, title, 18, c["ink"], DISPLAY, 800),
    ]
    for i, line in enumerate(lines):
        out.append(t(x + 16, y + 76 + i * 19, line, 12.5, c["muted"], MONO, 400))
    return "".join(out)


def flow(c, d, dur, begin=0.0, color=None, dashed=False, back=False):
    color = color or c["red"]
    dash = ' stroke-dasharray="4 5"' if dashed else ""
    out = [f'<path d="{d}" fill="none" stroke="{c["muted"]}" stroke-opacity="0.55" stroke-width="1.4"{dash}/>']
    if not dashed:
        out.append(
            f'<circle r="4" fill="{color}"><animateMotion path="{d}" dur="{dur}s" begin="{begin}s" repeatCount="indefinite"/>'
            f'<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="{dur}s" begin="{begin}s" repeatCount="indefinite"/></circle>'
        )
        if back:
            out.append(
                f'<circle r="3" fill="{c["ok"]}"><animateMotion path="{d}" dur="{dur}s" begin="{begin + dur / 2}s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear"/>'
                f'<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="{dur}s" begin="{begin + dur / 2}s" repeatCount="indefinite"/></circle>'
            )
    return "".join(out)


def architecture(c):
    W, H = 1200, 520
    p = [tricolore_strip(c, 0, W, 4)]
    p.append(t(40, 52, "How Quadernote fits together", 24, c["ink"], DISPLAY, 800))
    p.append(t(40, 78, "Two devices, one notebook. Everything lives at home on the OptiPlex; nothing is exposed to the internet.", 14, c["muted"], UI))

    # devices
    p.append(box(c, 40, 120, 230, 140, "LAPTOP · IN CLASS", "React + TS app", ["fast typing, Enter ↵", "localStorage cache", "sync every 30 s"], c["red"], pulse_begin=0))
    p.append(box(c, 40, 320, 230, 140, "PHONE · AFTER CLASS", "same app, same URL", ["fill NULLs, reveal verbs", "localStorage cache", "PWA offline in M3"], c["red"], pulse_begin=2))

    # tailnet band
    p.append(f'<rect x="300" y="108" width="150" height="364" rx="16" fill="none" stroke="{c["verde"]}" stroke-width="1.6" stroke-dasharray="7 6"/>')
    p.append(t(375, 132, "TAILSCALE", 11, c["verde"], MONO, 700, "middle", 'letter-spacing="1.5"'))
    p.append(t(375, 150, "private tailnet", 12, c["muted"], MONO, 400, "middle"))
    p.append(t(375, 450, "tailscale serve", 12, c["muted"], MONO, 400, "middle"))
    p.append(t(375, 465, "HTTPS *.ts.net", 12, c["muted"], MONO, 400, "middle"))

    # OptiPlex
    ox, oy, ow, oh = 480, 108, 520, 384
    p.append(f'<rect x="{ox}" y="{oy}" width="{ow}" height="{oh}" rx="16" fill="{c["paper"]}" stroke="{c["ink"]}" stroke-width="1.6"/>')
    p.append(t(ox + 18, oy + 26, "OPTIPLEX 7050 MICRO · UBUNTU 24.04 · COMPOSE", 11, c["ink"], MONO, 700, extra='letter-spacing="1.2"'))
    p.append(f'<circle cx="{ox + ow - 22}" cy="{oy + 22}" r="5" fill="{c["ok"]}"><animate attributeName="opacity" values="1;0.25;1" dur="2s" repeatCount="indefinite"/></circle>')
    p.append(t(ox + ow - 34, oy + 26, "24/7", 11, c["ok"], MONO, 700, "end"))

    p.append(box(c, ox + 18, oy + 44, 232, 150, "API · :8000", "FastAPI", ["/api/state  /api/lessons", "serves the built web app", "Alembic on start"]))
    p.append(box(c, ox + 270, oy + 44, 232, 150, "DB", "Postgres 17", ["+ pgvector (M8)", "lessons · entries · verbs", "assessments · JSONB extra"]))
    p.append(box(c, ox + 18, oy + 214, 232, 150, "BACKUP · 03:00", "pg_dump + restic", ["14 local dumps", "restore-test.sh", "encrypted off-site"]))
    p.append(box(c, ox + 270, oy + 214, 232, 150, "VOLUMES", "pgdata · ./backups", ["restart: unless-stopped", "BIOS AC recovery: on", "127.0.0.1 only"]))

    # outside services
    p.append(box(c, 1024, 152, 150, 150, "M4 · SOON", "Claude API", ["Haiku · Sonnet", "Opus vision (M6)", "cost in llm_calls"], c["muted"], dashed=True))
    p.append(box(c, 1024, 322, 150, 150, "OFF-SITE", "Backblaze B2", ["restic snapshots", "14 d · 8 w · 12 m"], c["verde"]))

    # flows
    p.append(flow(c, "M 270 190 C 330 190, 420 210, 498 220", 2.4, 0, back=True))
    p.append(flow(c, "M 270 390 C 340 390, 420 260, 498 236", 2.4, 1.2, back=True))
    p.append(flow(c, f"M {ox + 250} {oy + 119} L {ox + 270} {oy + 119}", 1.2, 0.3, back=True))
    p.append(flow(c, f"M {ox + 386} {oy + 194} C {ox + 386} {oy + 207}, {ox + 134} {oy + 201}, {ox + 134} {oy + 214}", 2.4, 0.6, c["verde"]))
    p.append(flow(c, f"M {ox + 134} {oy + 364} C {ox + 134} {oy + 376}, {ox + 160} {oy + 378}, {ox + 200} {oy + 378} L 1004 {oy + 378} C 1014 {oy + 378}, 1014 397, 1024 397", 3.4, 1, c["verde"]))
    p.append(flow(c, f"M {ox + ow} 227 L 1024 227", 3, 0, dashed=True))

    # legend
    p.append(f'<circle cx="48" cy="497" r="4" fill="{c["red"]}"/>' + t(58, 501, "lesson pushed (last write wins)", 12, c["muted"], MONO))
    p.append(f'<circle cx="300" cy="497" r="3" fill="{c["ok"]}"/>' + t(310, 501, "pulled by the other device", 12, c["muted"], MONO))

    return frame(W, H, c, "\n".join("    " + x for x in p), "Architecture: laptop and phone reach a FastAPI + Postgres 17 stack on a Dell OptiPlex through Tailscale; nightly pg_dump + restic backups go to Backblaze B2; Claude API comes in M4.")


# ---------------------------------------------------------------- milestones

MILESTONES = [
    ("M1", "React + TS port", "1:1 with the Artifact", "done"),
    ("M2", "Server · sync", "OptiPlex, backups", "done"),
    ("M3", "Offline PWA", "IndexedDB, airplane mode", "review"),
    ("M4", "Claude API", "“Opracuj lekcję” in 1 click", "todo"),
    ("M5", "FSRS reviews", "what to repeat today", "todo"),
    ("M6", "Notebook OCR", "photo → checked words", "todo"),
    ("M7", "Voice", "repeat after me, scored", "todo"),
    ("M8", "Search · users", "by meaning, 2nd user", "todo"),
]


def milestones(c):
    W, H = 1200, 330
    p = [tricolore_strip(c, 0, W, 4)]
    p.append(t(40, 50, "Un sassolino alla volta", 24, c["ink"], DISPLAY, 800))
    p.append(t(330, 50, "one pebble at a time: every milestone ends with something that works on a real lesson", 14, c["muted"], UI))

    xs = [95 + i * 144 for i in range(8)]
    ys = [190 + (-34 if i % 2 else 30) for i in range(8)]
    pts = list(zip(xs, ys))
    d = f"M {pts[0][0]} {pts[0][1]}"
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        mx = (x0 + x1) / 2
        d += f" C {mx} {y0}, {mx} {y1}, {x1} {y1}"
    p.append(f'<path d="{d}" fill="none" stroke="{c["line"]}" stroke-width="10" stroke-linecap="round"/>')
    p.append(f'<path d="{d}" fill="none" stroke="{c["muted"]}" stroke-width="1.6" stroke-dasharray="2 9" stroke-linecap="round"/>')

    # done part of the road in green
    done = f"M {pts[0][0]} {pts[0][1]}"
    for (x0, y0), (x1, y1) in zip(pts[:2], pts[1:3]):
        mx = (x0 + x1) / 2
        done += f" C {mx} {y0}, {mx} {y1}, {x1} {y1}"
    p.append(f'<path d="{done}" fill="none" stroke="{c["verde"]}" stroke-width="4" stroke-linecap="round" stroke-dasharray="400" stroke-dashoffset="400">'
             f'<animate attributeName="stroke-dashoffset" values="400;0;0" keyTimes="0;0.35;1" dur="6s" repeatCount="indefinite"/></path>')

    for i, ((x, y), (m, name, sub, status)) in enumerate(zip(pts, MILESTONES)):
        rx, ry = 30, 23
        # irregular pebble
        peb = f"M {x - rx} {y} C {x - rx} {y - ry - 4}, {x + rx + 6} {y - ry}, {x + rx} {y + 2} C {x + rx - 2} {y + ry}, {x - rx + 4} {y + ry + 3}, {x - rx} {y} Z"
        if status == "done":
            fill, stroke, label = c["verde"], c["verde"], "#ffffff"
        elif status == "review":
            fill, stroke, label = c["red"], c["red"], "#ffffff"
        else:
            fill, stroke, label = c["card"], c["line"], c["muted"]
        if status == "review":
            # pulsing ring, scaled around the pebble's own centre
            rel = f"M {-rx} 0 C {-rx} {-ry - 4}, {rx + 6} {-ry}, {rx} 2 C {rx - 2} {ry}, {-rx + 4} {ry + 3}, {-rx} 0 Z"
            p.append(
                f'<g transform="translate({x} {y})"><path d="{rel}" fill="none" stroke="{c["red"]}" stroke-width="2">'
                f'<animateTransform attributeName="transform" type="scale" values="1;1.45;1.45" keyTimes="0;0.8;1" dur="2s" repeatCount="indefinite"/>'
                f'<animate attributeName="opacity" values="0.9;0;0" keyTimes="0;0.8;1" dur="2s" repeatCount="indefinite"/></path></g>'
            )
        p.append(f'<path d="{peb}" fill="{fill}" stroke="{stroke}" stroke-width="1.6" filter="url(#soft)"/>')
        p.append(t(x, y + 6, m, 16, label, MONO, 700, "middle"))
        if i % 2 == 0:
            ty, ty2 = y + 50, y + 68
        else:
            ty, ty2 = y - 58, y - 40
        p.append(t(x, ty, name, 14, c["ink"], UI, 700, "middle"))
        p.append(t(x, ty2, sub, 11.5, c["muted"], MONO, 400, "middle"))
        tag = {"done": "✓ done", "review": "● next", "todo": ""}[status]
        if tag:
            col = c["verde"] if status == "done" else c["red"]
            p.append(t(x, (ty2 + 18) if i % 2 == 0 else (ty - 20), tag, 11.5, col, MONO, 700, "middle"))

    # the little scooter-red dot travelling to the current pebble
    p.append(f'<circle r="6" fill="{c["red"]}" stroke="{c["sheet"]}" stroke-width="2"><animateMotion path="{done}" dur="6s" keyPoints="0;1;1" keyTimes="0;0.35;1" calcMode="linear" repeatCount="indefinite"/>'
             f'<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.33;0.37;1" dur="6s" repeatCount="indefinite"/></circle>')
    return frame(W, H, c, "\n".join("    " + x for x in p), "Milestones M1 to M8 as pebbles on a path: M1 and M2 done, M3 next, M4 to M8 planned.")


# ---------------------------------------------------------------- footer


def footer(c):
    W, H = 1200, 120
    p = []
    wave = "M 0 70 " + " ".join(f"Q {x + 50} {50 if (x // 100) % 2 == 0 else 90}, {x + 100} 70" for x in range(0, 1300, 100))
    for i, col in enumerate((c["verde"], c["bianco"], c["rosso"])):
        p.append(
            f'<path d="{wave}" transform="translate(0 {i * 7 - 7})" fill="none" stroke="{col}" stroke-width="6" stroke-linecap="round">'
            f'<animateTransform attributeName="transform" type="translate" values="0 {i * 7 - 7};-200 {i * 7 - 7}" dur="6s" repeatCount="indefinite"/></path>'
        )
    p.append(f'<rect x="380" y="34" width="440" height="56" rx="28" fill="{c["sheet"]}" stroke="{c["line"]}" filter="url(#soft)"/>')
    p.append(t(600, 69, "Grazie mille · a presto!  ☕", 20, c["ink"], DISPLAY, 800, "middle"))
    return frame(W, H, c, "\n".join("    " + x for x in p), "Grazie mille, a presto!")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in (("header", header), ("architecture", architecture), ("milestones", milestones), ("footer", footer)):
        for theme, colours in THEMES.items():
            (OUT / f"{name}-{theme}.svg").write_text(fn(colours), encoding="utf-8")
    print(f"wrote {len(list(OUT.glob('*.svg')))} SVGs to {OUT}")


if __name__ == "__main__":
    main()
