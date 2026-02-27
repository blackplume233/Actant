#!/usr/bin/env python3
"""
Nexus A v5 — Bold A with colored intersection nodes

Maple-inspired bold A. Lines are monochrome (context-adaptive).
Each of the 3 intersection nodes has its own identity color:
  apex   = violet  #8B5CF6
  left   = amber   #F59E0B
  right  = emerald  #10B981
PNG rendering uses 2-4× oversampling for crack-free smooth strokes.
"""
import os

# ── Node identity colors ─────────────────────────────────────────
NC = ("#8B5CF6", "#F59E0B", "#10B981")   # apex, left, right

# ── Bezier helpers ────────────────────────────────────────────────

def _bez(t, p0, p1, p2, p3):
    u = 1 - t
    return (
        u**3*p0[0] + 3*u**2*t*p1[0] + 3*u*t**2*p2[0] + t**3*p3[0],
        u**3*p0[1] + 3*u**2*t*p1[1] + 3*u*t**2*p2[1] + t**3*p3[1],
    )

def _t_at_y(target, p0, p1, p2, p3):
    lo, hi = 0.0, 1.0
    for _ in range(64):
        mid = (lo + hi) / 2
        _, y = _bez(mid, p0, p1, p2, p3)
        if abs(y - target) < 0.05:
            return mid
        if y > target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2

def _ctrl(bx, by, apex, bow, side):
    dx, dy = apex[0] - bx, apex[1] - by
    s = -1 if side == "left" else 1
    return (
        (bx, by),
        (bx + dx*0.28 + s*bow, by + dy*0.28),
        (bx + dx*0.70 + s*bow*0.5, by + dy*0.70),
        apex,
    )

def _d(p0, p1, p2, p3):
    return (f"M {p0[0]:.1f} {p0[1]:.1f} "
            f"C {p1[0]:.1f} {p1[1]:.1f}, "
            f"{p2[0]:.1f} {p2[1]:.1f}, "
            f"{p3[0]:.1f} {p3[1]:.1f}")

def _da(x1, y, x2, arc):
    return (f"M {x1:.1f} {y:.1f} "
            f"Q {(x1+x2)/2:.1f} {y - arc:.1f}, {x2:.1f} {y:.1f}")


# ══════════════════════════════════════════════════════════════════
#  FULL LOGO  800 × 800
# ══════════════════════════════════════════════════════════════════

F      = 800
F_APEX = (400, 82)
F_BY   = 718
F_LBX  = 112
F_RBX  = 688
F_BOW  = 12
F_CB_Y = 432
F_CB_A = 8

F_LS = 28.0    # leg stroke
F_CS = 22.0    # crossbar stroke
F_AR = 26.0    # apex node radius
F_NR = 21.0    # junction node radius

def _fg():
    lc = _ctrl(F_LBX, F_BY, F_APEX, F_BOW, "left")
    rc = _ctrl(F_RBX, F_BY, F_APEX, F_BOW, "right")
    return lc, rc, _bez(_t_at_y(F_CB_Y, *lc), *lc), _bez(_t_at_y(F_CB_Y, *rc), *rc)

def full_svg(color="currentColor", bg=None):
    lc, rc, jl, jr = _fg()
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {F} {F}" width="{F}" height="{F}">']
    if bg:
        o.append(f'  <rect width="{F}" height="{F}" fill="{bg}"/>')
    o.append(f'  <g stroke="{color}" fill="none" stroke-linecap="round" stroke-linejoin="round">')
    o.append(f'    <path d="{_d(*lc)}" stroke-width="{F_LS}"/>')
    o.append(f'    <path d="{_d(*rc)}" stroke-width="{F_LS}"/>')
    o.append(f'    <path d="{_da(jl[0], F_CB_Y, jr[0], F_CB_A)}" stroke-width="{F_CS}"/>')
    o.append(f'  </g>')
    o.append(f'  <circle cx="{F_APEX[0]}" cy="{F_APEX[1]}" r="{F_AR}" fill="{NC[0]}"/>')
    o.append(f'  <circle cx="{jl[0]:.1f}" cy="{jl[1]:.1f}" r="{F_NR}" fill="{NC[1]}"/>')
    o.append(f'  <circle cx="{jr[0]:.1f}" cy="{jr[1]:.1f}" r="{F_NR}" fill="{NC[2]}"/>')
    o.append('</svg>')
    return "\n".join(o)


# ══════════════════════════════════════════════════════════════════
#  ICON  128 × 128
# ══════════════════════════════════════════════════════════════════

IV     = 128
I_APEX = (64, 10)
I_BY   = 118
I_LBX  = 14
I_RBX  = 114
I_BOW  = 2
I_CB_Y = 70
I_CB_A = 2

I_LS = 6.0
I_CS = 5.0
I_AR = 6.5
I_NR = 5.5

def _ig():
    lc = _ctrl(I_LBX, I_BY, I_APEX, I_BOW, "left")
    rc = _ctrl(I_RBX, I_BY, I_APEX, I_BOW, "right")
    return lc, rc, _bez(_t_at_y(I_CB_Y, *lc), *lc), _bez(_t_at_y(I_CB_Y, *rc), *rc)

def icon_svg(color="currentColor", bg=None):
    lc, rc, jl, jr = _ig()
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {IV} {IV}" width="{IV}" height="{IV}">']
    if bg:
        o.append(f'  <rect width="{IV}" height="{IV}" fill="{bg}"/>')
    o.append(f'  <g stroke="{color}" fill="none" stroke-linecap="round" stroke-linejoin="round">')
    o.append(f'    <path d="{_d(*lc)}" stroke-width="{I_LS}"/>')
    o.append(f'    <path d="{_d(*rc)}" stroke-width="{I_LS}"/>')
    o.append(f'    <path d="{_da(jl[0], I_CB_Y, jr[0], I_CB_A)}" stroke-width="{I_CS}"/>')
    o.append(f'  </g>')
    o.append(f'  <circle cx="{I_APEX[0]}" cy="{I_APEX[1]}" r="{I_AR}" fill="{NC[0]}"/>')
    o.append(f'  <circle cx="{jl[0]:.1f}" cy="{jl[1]:.1f}" r="{I_NR}" fill="{NC[1]}"/>')
    o.append(f'  <circle cx="{jr[0]:.1f}" cy="{jr[1]:.1f}" r="{I_NR}" fill="{NC[2]}"/>')
    o.append('</svg>')
    return "\n".join(o)


# ══════════════════════════════════════════════════════════════════
#  OUTPUT
# ══════════════════════════════════════════════════════════════════

DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    svgs = {
        "nexus-a":            (full_svg, {}),
        "nexus-a-dark":       (full_svg, {"color": "#1a1a1a", "bg": "#ffffff"}),
        "nexus-a-light":      (full_svg, {"color": "#e8e8e8", "bg": "#1a1a1a"}),
        "nexus-a-brand":      (full_svg, {"color": "#3b82f6", "bg": "#0f172a"}),
        "nexus-a-icon":       (icon_svg, {}),
        "nexus-a-icon-dark":  (icon_svg, {"color": "#1a1a1a", "bg": "#ffffff"}),
        "nexus-a-icon-light": (icon_svg, {"color": "#e8e8e8", "bg": "#1a1a1a"}),
    }
    for name, (fn, kw) in svgs.items():
        with open(os.path.join(DIR, f"{name}.svg"), "w", encoding="utf-8") as f:
            f.write(fn(**kw))
        print(f"  [OK] {name}.svg")
    try:
        _pngs()
    except Exception as e:
        print(f"  [WARN] PNG: {e}")
    print("\nDone.")


# ══════════════════════════════════════════════════════════════════
#  PNG  — 2-4× oversampled for smooth, crack-free strokes
# ══════════════════════════════════════════════════════════════════

STEPS = 300   # polyline density for smooth curves

def _polyline(crv, ox, oy, sc):
    return [(ox + _bez(i/STEPS, *crv)[0]*sc,
             oy + _bez(i/STEPS, *crv)[1]*sc) for i in range(STEPS+1)]

def _arcline(jl, jr, cb_y, cb_a, ox, oy, sc):
    pts = []
    for i in range(STEPS+1):
        f = i / STEPS
        x = jl[0] + (jr[0] - jl[0]) * f
        y = cb_y - cb_a * 4 * f * (1 - f)
        pts.append((ox + x*sc, oy + y*sc))
    return pts

def _pngs():
    from PIL import Image, ImageDraw

    # ── Full-logo preview (4 variants, 2× oversample) ────────────
    TILE = 500
    OVR = 2
    RT = TILE * OVR
    variants = [
        ("#1a1a1a", None),
        ("#1a1a1a", "#ffffff"),
        ("#e8e8e8", "#1a1a1a"),
        ("#3b82f6", "#0f172a"),
    ]
    lc, rc, jl, jr = _fg()
    sc = RT / F

    big = Image.new("RGBA", (RT * len(variants), RT), (255,255,255,255))
    d = ImageDraw.Draw(big)

    for idx, (col, bg) in enumerate(variants):
        ox = idx * RT
        if bg:
            d.rectangle([ox, 0, ox+RT-1, RT-1], fill=bg)

        for crv in (lc, rc):
            d.line(_polyline(crv, ox, 0, sc), fill=col,
                   width=max(2, round(F_LS*sc)), joint="curve")
        d.line(_arcline(jl, jr, F_CB_Y, F_CB_A, ox, 0, sc), fill=col,
               width=max(2, round(F_CS*sc)), joint="curve")

        nodes = [(F_APEX, F_AR, NC[0]), (jl, F_NR, NC[1]), (jr, F_NR, NC[2])]
        for (nx, ny), r, nc in nodes:
            pr = round(r * sc)
            cx, cy = ox + nx*sc, ny*sc
            d.ellipse([cx-pr, cy-pr, cx+pr, cy+pr], fill=nc)

    preview = big.resize((TILE * len(variants), TILE), Image.LANCZOS)
    preview.save(os.path.join(DIR, "preview-sheet.png"), "PNG")
    print("  [OK] preview-sheet.png")

    # ── Multi-size icon PNGs (4× oversample for small) ────────────
    SIZES = [16, 24, 32, 48, 64, 128, 256]
    ilc, irc, ijl, ijr = _ig()
    icons = {}

    for sz in SIZES:
        ovr = 4 if sz <= 32 else 2
        rsz = sz * ovr
        s = rsz / IV
        boost = 1.5 if sz <= 20 else (1.2 if sz <= 32 else 1.0)

        im = Image.new("RGBA", (rsz, rsz), (0,0,0,0))
        dd = ImageDraw.Draw(im)

        for crv in (ilc, irc):
            dd.line(_polyline(crv, 0, 0, s), fill="#1a1a1a",
                    width=max(1, round(I_LS*s*boost)), joint="curve")
        dd.line(_arcline(ijl, ijr, I_CB_Y, I_CB_A, 0, 0, s), fill="#1a1a1a",
                width=max(1, round(I_CS*s*boost)), joint="curve")

        nodes = [(I_APEX, I_AR, NC[0]), (ijl, I_NR, NC[1]), (ijr, I_NR, NC[2])]
        for (nx, ny), r, nc in nodes:
            pr = max(1, round(r*s*boost))
            cx, cy = nx*s, ny*s
            dd.ellipse([cx-pr, cy-pr, cx+pr, cy+pr], fill=nc)

        im = im.resize((sz, sz), Image.LANCZOS)
        im.save(os.path.join(DIR, f"icon-{sz}.png"), "PNG")
        icons[sz] = im
        print(f"  [OK] icon-{sz}.png")

    # ── Size comparison sheet ─────────────────────────────────────
    DISP = 128; PAD = 12
    cols = len(SIZES)
    sheet = Image.new("RGBA", (cols*(DISP+PAD)+PAD, DISP+PAD*2+20), (255,255,255,255))
    sd = ImageDraw.Draw(sheet)
    for i, sz in enumerate(SIZES):
        x = PAD + i*(DISP+PAD)
        up = icons[sz].resize((DISP, DISP), Image.NEAREST)
        sheet.paste(up, (x, PAD), up)
        lbl = f"{sz}px"
        try: bb = sd.textbbox((0,0), lbl); tw = bb[2]-bb[0]
        except: tw = len(lbl)*7
        sd.text((x+(DISP-tw)//2, PAD+DISP+4), lbl, fill="#888888")
    sheet.save(os.path.join(DIR, "icon-sizes-preview.png"), "PNG")
    print("  [OK] icon-sizes-preview.png")


if __name__ == "__main__":
    print("Generating Nexus A v5 (colored nodes + smooth strokes)...\n")
    main()
