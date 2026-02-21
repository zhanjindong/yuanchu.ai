#!/usr/bin/env python3
"""
YuanChu AI Logo Generator - PNG Edition
8 designs x 2 variants (dark + transparent) = 16 PNG files
Uses 4x supersampling for smooth anti-aliased lines
"""

import os
import math
from PIL import Image, ImageDraw

# ── Constants ──
CANVAS = 2048
OUTPUT = 512
CENTER = CANVAS // 2
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

WHITE = (255, 255, 255, 255)
WHITE_A = lambda a: (255, 255, 255, min(255, max(0, a)))
BLACK = (0, 0, 0, 255)
TRANSPARENT = (0, 0, 0, 0)

THIN = 5       # ~1.25px final
NORMAL = 7     # ~1.75px final
MEDIUM = 10    # ~2.5px final


# ── Utility Functions ──

def new_canvas(bg='black'):
    if bg == 'black':
        return Image.new('RGBA', (CANVAS, CANVAS), BLACK)
    return Image.new('RGBA', (CANVAS, CANVAS), TRANSPARENT)


def finalize_fast(draw_func, name):
    img_dark = new_canvas('black')
    draw_dark = ImageDraw.Draw(img_dark)
    draw_func(draw_dark)
    dark = img_dark.resize((OUTPUT, OUTPUT), Image.LANCZOS)
    dark.save(os.path.join(OUTPUT_DIR, f'{name}_dark.png'), 'PNG')

    img_trans = new_canvas('transparent')
    draw_trans = ImageDraw.Draw(img_trans)
    draw_func(draw_trans)
    trans = img_trans.resize((OUTPUT, OUTPUT), Image.LANCZOS)
    trans.save(os.path.join(OUTPUT_DIR, f'{name}_transparent.png'), 'PNG')
    print(f'  {name}_dark.png + {name}_transparent.png')


def draw_circle(draw, cx, cy, radius, color=WHITE, width=NORMAL):
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    draw.ellipse(bbox, outline=color, width=width)


def draw_dot(draw, cx, cy, radius, color=WHITE):
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    draw.ellipse(bbox, fill=color)


def draw_arc(draw, cx, cy, radius, start_deg, end_deg, color=WHITE, width=NORMAL):
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    draw.arc(bbox, start_deg, end_deg, fill=color, width=width)


def draw_smooth_line(draw, points, color=WHITE, width=NORMAL):
    if len(points) < 2:
        return
    draw.line(points, fill=color, width=width, joint='curve')


# ── Design V1: Singularity (极简奇点) ──
# The most minimal expression: singularity (Tao) gives birth to the event horizon (One).
# A single dot and a single ring — nothing more.
def v1_singularity():
    def draw(d):
        draw_dot(d, CENTER, CENTER, 30, WHITE)
        draw_circle(d, CENTER, CENTER, 400, WHITE_A(210), NORMAL)

    finalize_fast(draw, 'v1_singularity')


# ── Design V2: Geodesic Convergence (测地线汇聚) ──
# In curved spacetime, straight lines become geodesics that bend toward mass.
# Lines arrive from different directions, all curving toward the unseen center.
def v2_geodesic_convergence():
    def draw(d):
        n_lines = 7
        for i in range(n_lines):
            base_angle = i * (360.0 / n_lines)
            rad_base = math.radians(base_angle)

            points = []
            n_samples = 800
            for t in range(n_samples):
                frac = t / (n_samples - 1)
                # Start from outer edge, move inward
                r_outer = CANVAS * 0.47
                r_inner = 40
                r = r_outer * (1 - frac) + r_inner * frac

                # Bending increases as we approach center (stronger gravity)
                bend = (frac ** 1.8) * 1.2
                # Alternate bend direction for visual variety
                direction = 1 if i % 2 == 0 else -1
                theta = rad_base + bend * direction

                x = CENTER + r * math.cos(theta)
                y = CENTER + r * math.sin(theta)
                points.append((x, y))

            # Fade line: stronger near center
            alpha = 180 + int(40 * math.sin(i * math.pi / n_lines))
            draw_smooth_line(d, points, WHITE_A(alpha), THIN)

        draw_dot(d, CENTER, CENTER, 28, WHITE)

    finalize_fast(draw, 'v2_geodesic_convergence')


# ── Design V3: Spacetime Warp (时空弯曲) ──
# A minimal grid (7 lines each direction) warped by a central gravitational well.
# The grid does not extend to edges — it's a floating, logo-like composition.
def v3_spacetime_warp():
    def draw(d):
        n_lines = 7
        margin = CANVAS * 0.12
        usable = CANVAS - 2 * margin
        spacing = usable / (n_lines + 1)
        warp_strength = 220
        warp_sigma = 300

        def warp_offset(px, py):
            dx = px - CENTER
            dy = py - CENTER
            dist = math.sqrt(dx * dx + dy * dy) + 1e-9
            pull = warp_strength / (1 + (dist / warp_sigma) ** 2)
            return -dx / dist * pull, -dy / dist * pull

        for i in range(1, n_lines + 1):
            base_x = margin + spacing * i
            points = []
            for t in range(600):
                y = margin + usable * t / 599
                ox, oy = warp_offset(base_x, y)
                points.append((base_x + ox, y + oy))
            dist_c = abs(base_x - CENTER)
            alpha = max(100, 230 - int(dist_c / 4))
            draw_smooth_line(d, points, WHITE_A(alpha), THIN)

        for i in range(1, n_lines + 1):
            base_y = margin + spacing * i
            points = []
            for t in range(600):
                x = margin + usable * t / 599
                ox, oy = warp_offset(x, base_y)
                points.append((x + ox, base_y + oy))
            dist_c = abs(base_y - CENTER)
            alpha = max(100, 230 - int(dist_c / 4))
            draw_smooth_line(d, points, WHITE_A(alpha), THIN)

        draw_dot(d, CENTER, CENTER, 24, WHITE)

    finalize_fast(draw, 'v3_spacetime_warp')


# ── Design V4: Tao Layers (道生万物) ──
# "Tao begets One, One begets Two, Two begets Three, Three begets all things."
# Layers radiate outward: dot(Tao) → 1 arc → 2 arcs → 3 arcs.
# Perfectly mirrors black hole structure: singularity → photon sphere → event horizon → accretion disk.
def v4_tao_layers():
    def draw(d):
        draw_dot(d, CENTER, CENTER, 28, WHITE)

        # Layer "一" (One): single arc, ~280 degrees
        draw_arc(d, CENTER, CENTER, 240, 190, 490, WHITE_A(230), NORMAL)

        # Layer "二" (Two): two arcs, each ~120 degrees, evenly spaced
        draw_arc(d, CENTER, CENTER, 420, 20, 150, WHITE_A(190), NORMAL)
        draw_arc(d, CENTER, CENTER, 420, 200, 330, WHITE_A(190), NORMAL)

        # Layer "三" (Three): three arcs, each ~80 degrees, evenly spaced
        draw_arc(d, CENTER, CENTER, 600, 350, 440, WHITE_A(140), NORMAL)
        draw_arc(d, CENTER, CENTER, 600, 120, 210, WHITE_A(140), NORMAL)
        draw_arc(d, CENTER, CENTER, 600, 230, 320, WHITE_A(140), NORMAL)

    finalize_fast(draw, 'v4_tao_layers')


# ── Design V5: Broken Horizon (断裂视界) ──
# The event horizon is the boundary of the knowable universe.
# An incomplete circle with deliberate gaps — suggesting infinity and the unknown.
# Paired with a smaller inner arc to add depth.
def v5_broken_horizon():
    def draw(d):
        draw_dot(d, CENTER, CENTER, 28, WHITE)
        # Main horizon — large, with a meaningful gap at upper-right
        draw_arc(d, CENTER, CENTER, 420, 50, 330, WHITE_A(220), NORMAL)
        # Inner arc — partial, offset angle, adds asymmetric depth
        draw_arc(d, CENTER, CENTER, 260, 200, 10, WHITE_A(150), THIN)

    finalize_fast(draw, 'v5_broken_horizon')


# ── Design V6: Golden Spiral (黄金螺旋) ──
# Archimedean spiral with 3 arms — the accretion disk's spiraling matter
# meeting Fibonacci's universal beauty. All paths converge to one origin.
def v6_golden_spiral():
    def draw(d):
        n_arms = 3
        max_r = CANVAS * 0.44

        for arm in range(n_arms):
            offset = arm * (2 * math.pi / n_arms)
            points = []
            # Archimedean spiral: r = a + b*theta
            for t in range(2000):
                theta = t * 0.005 + offset
                r = 30 + (max_r - 30) * (theta - offset) / (2 * math.pi * 2.5)
                if r > max_r:
                    break
                if r < 30:
                    continue
                x = CENTER + r * math.cos(theta)
                y = CENTER + r * math.sin(theta)
                points.append((x, y))

            if len(points) > 1:
                alpha = 210 - arm * 30
                draw_smooth_line(d, points, WHITE_A(alpha), THIN)

        draw_dot(d, CENTER, CENTER, 26, WHITE)

    finalize_fast(draw, 'v6_golden_spiral')


# ── Design V7: Lensing Rings (引力透镜环) ──
# Gravitational lensing distorts perfect circles into ellipses.
# Concentric rings with progressive eccentricity and rotation — the deeper you go,
# the more spacetime is warped.
def v7_lensing_rings():
    def draw(d):
        n_rings = 5
        for i in range(n_rings):
            layer = n_rings - 1 - i  # draw outer first
            frac = (layer + 1) / n_rings
            base_r = 160 + layer * 100

            # Inner rings are more distorted
            ecc = 1.0 + 0.5 * (1 - frac)
            rx = int(base_r * ecc)
            ry = int(base_r / ecc)

            # Each ring rotated further
            rotation = layer * 30
            rot_rad = math.radians(rotation)

            points = []
            for t in range(900):
                theta = 2 * math.pi * t / 900
                ex = rx * math.cos(theta)
                ey = ry * math.sin(theta)
                x = CENTER + ex * math.cos(rot_rad) - ey * math.sin(rot_rad)
                y = CENTER + ex * math.sin(rot_rad) + ey * math.cos(rot_rad)
                points.append((x, y))
            points.append(points[0])

            alpha = 230 - layer * 30
            draw_smooth_line(d, points, WHITE_A(alpha), THIN)

        draw_dot(d, CENTER, CENTER, 24, WHITE)

    finalize_fast(draw, 'v7_lensing_rings')


# ── Design V8: YuanChu Unity (元初统一) ──
# The synthesis of all concepts: singularity + broken horizon + sweeping geodesic.
# Three core black-hole ideas in one minimal mark.
def v8_yuanchu_unity():
    def draw(d):
        draw_dot(d, CENTER, CENTER, 28, WHITE)

        # Main broken horizon arc
        draw_arc(d, CENTER, CENTER, 380, 40, 300, WHITE_A(220), NORMAL)

        # A sweeping geodesic curve that crosses through
        points = []
        for t in range(1000):
            frac = t / 999
            r = CANVAS * 0.46 * (1 - frac * 0.8)
            theta = math.radians(310) + frac * math.pi * 0.8
            curve = math.sin(frac * math.pi) * 0.35
            x = CENTER + r * math.cos(theta + curve)
            y = CENTER + r * math.sin(theta + curve)
            points.append((x, y))
        draw_smooth_line(d, points, WHITE_A(170), THIN)

        # Outer faint arc — hint of a larger structure
        draw_arc(d, CENTER, CENTER, 580, 150, 250, WHITE_A(110), THIN)

    finalize_fast(draw, 'v8_yuanchu_unity')


# ── Main ──
if __name__ == '__main__':
    print('=' * 50)
    print('YuanChu AI Logo Generator')
    print('=' * 50)

    v1_singularity()
    v2_geodesic_convergence()
    v3_spacetime_warp()
    v4_tao_layers()
    v5_broken_horizon()
    v6_golden_spiral()
    v7_lensing_rings()
    v8_yuanchu_unity()

    print('=' * 50)
    print(f'Done! 16 PNG files generated in {OUTPUT_DIR}')
    print('=' * 50)
