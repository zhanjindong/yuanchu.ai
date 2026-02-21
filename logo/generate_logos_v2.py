#!/usr/bin/env python3
"""
YuanChu AI Logo Generator — V2 Edition
5 concepts × 2 variants (dark + transparent) = 10 PNG files
Uses 4x supersampling for smooth anti-aliased lines

第二轮设计：灵感源自原初黑洞，融合黎曼几何、史瓦西黑洞、道家哲学
与 v1-v8 的差异化策略：引入非圆几何、粗细渐变、非对称构图、负空间、层级递进
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
THICK = 14     # ~3.5px final


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


# ═══════════════════════════════════════════════════════════
# 概念 A：引力透镜位移 (Gravitational Displacement)
# ═══════════════════════════════════════════════════════════
# 物理隐喻：爱因斯坦环效应 —— 引力透镜将远方光源的像折射成双重影像
# 两个略微偏移的圆环重叠，中心交叉区域形成 vesica piscis（鱼形）轮廓
# 暗示光线被引力弯曲后产生的「双像」现象
# 与"元初"品牌的关联：宇宙初始的引力场开始弯曲光线，诞生第一个可观测信号
#
# Physics: Einstein ring — gravitational lensing creates double images
# Two slightly offset circles overlap, forming a vesica piscis silhouette
# Suggests light bent by gravity — the first observable signal from the primordial cosmos

def v2a_gravitational_displacement():
    def draw(d):
        offset = int(CANVAS * 0.06)  # ~123px, 两圆圆心偏移量
        radius = int(CANVAS * 0.18)  # ~370px, 圆环半径

        # 外层圆环（左偏移）
        draw_circle(d, CENTER - offset, CENTER, radius, WHITE_A(200), NORMAL)
        # 外层圆环（右偏移）
        draw_circle(d, CENTER + offset, CENTER, radius, WHITE_A(200), NORMAL)

        # 在交叉区域内侧添加一条淡弧线，暗示像的汇聚
        inner_r = int(radius * 0.55)
        draw_arc(d, CENTER, CENTER, inner_r, 210, 330, WHITE_A(100), THIN)

        # 奇点 —— 中心白点
        draw_dot(d, CENTER, CENTER, 28, WHITE)

    finalize_fast(draw, 'v2a_gravitational_displacement')


# ═══════════════════════════════════════════════════════════
# 概念 B：史瓦西喉 (Schwarzschild Throat)
# ═══════════════════════════════════════════════════════════
# 物理隐喻：弗拉姆抛物面 (Flamm's Paraboloid) 的剖面
# 黑洞将三维空间弯曲成"漏斗喉"，用数学公式 z = 2√(rs·(r-rs)) 描绘
# 左右对称的两条抛物线曲线在底部（喉部）汇合，穿越曲线的淡色水平线表示嵌入的平坦空间
# 与"元初"品牌的关联：原初黑洞作为时空的第一个"喉管"，连接了宇宙的不同区域
#
# Physics: Flamm's Paraboloid — the embedding diagram of Schwarzschild black hole
# Two parabolic curves merge at the throat; horizontal lines show flat embedding space
# The primordial black hole as the first "throat" connecting different spacetime regions

def v2b_schwarzschild_throat():
    def draw(d):
        rs = CANVAS * 0.04       # 史瓦西半径 (~80px)
        r_max = CANVAS * 0.38    # 最大径向距离
        n_points = 800

        # Flamm 公式: z = 2 * sqrt(rs * (r - rs))
        # 将 r 映射到垂直轴（从下到上），z 映射到水平轴（左右对称）
        points_left = []
        points_right = []

        for i in range(n_points):
            r = rs + (r_max - rs) * i / (n_points - 1)
            z = 2 * math.sqrt(rs * (r - rs))

            # 垂直方向：喉部（r=rs）在中心偏下，r_max 在顶部
            y = CENTER + int((r_max * 0.6) - (r - rs) * 1.1)
            x_offset = int(z * 1.2)

            points_left.append((CENTER - x_offset, y))
            points_right.append((CENTER + x_offset, y))

        draw_smooth_line(d, points_left, WHITE_A(210), NORMAL)
        draw_smooth_line(d, points_right, WHITE_A(210), NORMAL)

        # 水平参考线 —— 表示嵌入的平坦空间
        throat_y = CENTER + int(r_max * 0.6)
        for i in range(4):
            y_line = throat_y - int((r_max * 0.8) * (i + 1) / 5)
            # 计算该 y 位置对应的曲线宽度
            r_at_y = rs + (throat_y - y_line) / 1.1
            if r_at_y > rs:
                z_at_y = 2 * math.sqrt(rs * (r_at_y - rs)) * 1.2
                half_w = int(z_at_y) + 60
                alpha = 60 + i * 10
                d.line(
                    [(CENTER - half_w, y_line), (CENTER + half_w, y_line)],
                    fill=WHITE_A(alpha), width=THIN
                )

        # 喉部奇点
        draw_dot(d, CENTER, throat_y, 26, WHITE)

    finalize_fast(draw, 'v2b_schwarzschild_throat')


# ═══════════════════════════════════════════════════════════
# 概念 C：递生 (Tao Emergence)
# ═══════════════════════════════════════════════════════════
# 哲学隐喻：道生一，一生二，二生三，三生万物 —— 从奇点递进生成
# 从中心白点出发，一条主弧线（一/One）向外延伸
# 从主弧线末端分裂出两条子弧（二/Two）
# 再各自分裂出细弧（三/Three），形成类似宇宙膨胀的分支结构
# 粗细递减（THICK→NORMAL→THIN）体现能量的传递与衰减
# 与"元初"品牌的关联：从"元初"的奇点诞生万物，正是"道"的具象化
#
# Philosophy: "Tao begets One, One begets Two, Two begets Three, Three begets all things"
# A branching arc structure radiating from a central singularity point
# Line width decreases with each generation: THICK → NORMAL → THIN

def v2c_tao_emergence():
    def draw(d):
        # 起始点下移 200px，让整体构图上下平衡
        origin_y = CENTER + 200

        # 奇点 —— 道（Tao）
        draw_dot(d, CENTER, origin_y, 30, WHITE)

        # 「一」—— 主干弧线：从奇点向上延伸
        r1_start = 70
        r1_end = 520
        base_angle = -90  # 正上方
        points_one = []
        n = 600
        for i in range(n):
            frac = i / (n - 1)
            r = r1_start + (r1_end - r1_start) * frac
            angle = math.radians(base_angle + frac * 12)
            x = CENTER + r * math.cos(angle)
            y = origin_y + r * math.sin(angle)
            points_one.append((x, y))
        draw_smooth_line(d, points_one, WHITE_A(240), THICK)

        # 「二」—— 从主干末端分出两条子弧，左右展开
        end_x, end_y = points_one[-1]
        end_angle = base_angle + 12

        branches_two = []
        for sign in [-1, 1]:
            r2_end = 320
            branch_pts = []
            for i in range(500):
                frac = i / 499
                r = frac * r2_end
                spread = sign * (40 + frac * 30)
                angle = math.radians(end_angle + spread)
                x = end_x + r * math.cos(angle)
                y = end_y + r * math.sin(angle)
                branch_pts.append((x, y))
            draw_smooth_line(d, branch_pts, WHITE_A(200), MEDIUM)
            branches_two.append(branch_pts)

        # 「三」—— 从每条二级弧线末端各分出 3 条细弧
        for branch in branches_two:
            bx, by = branch[-1]
            bx2, by2 = branch[-40]
            parent_angle = math.degrees(math.atan2(by - by2, bx - bx2))

            for k in range(3):
                spread = (k - 1) * 30
                sub_pts = []
                r3_end = 220
                for i in range(400):
                    frac = i / 399
                    r = frac * r3_end
                    angle = math.radians(parent_angle + spread + frac * 8)
                    x = bx + r * math.cos(angle)
                    y = by + r * math.sin(angle)
                    sub_pts.append((x, y))
                alpha = 170 - abs(k - 1) * 30
                draw_smooth_line(d, sub_pts, WHITE_A(alpha), NORMAL)

    finalize_fast(draw, 'v2c_tao_emergence')


# ═══════════════════════════════════════════════════════════
# 概念 D：光锥钻石 (Light Cone Diamond)
# ═══════════════════════════════════════════════════════════
# 物理隐喻：彭罗斯因果图 (Penrose Diagram)
# 黑洞的因果结构在彭罗斯图中表现为菱形/钻石形区域
# 3-4 个嵌套菱形（旋转正方形），由外到内递次缩小并微旋转
# 最内层接近点（奇点），暗示因果链条向奇点汇聚
# 与"元初"品牌的关联：宇宙的因果关系从第一个奇点开始展开
#
# Physics: Penrose Causal Diagram — the causal structure of a black hole
# Nested diamonds (rotated squares) converging toward a central singularity
# Each layer slightly rotated, suggesting the warping of causality near the singularity

def v2d_light_cone_diamond():
    def draw(d):
        radii = [550, 400, 260, 130]
        rotations = [0, 10, 20, 30]       # 逐层额外旋转角度
        alphas = [120, 160, 200, 240]
        widths = [THIN, THIN, NORMAL, NORMAL]

        for idx, (r, rot, alpha, w) in enumerate(zip(radii, rotations, alphas, widths)):
            # 菱形 = 旋转 45° 的正方形 + 逐层额外旋转
            base_rot = 45 + rot
            vertices = []
            for corner in range(4):
                angle = math.radians(base_rot + corner * 90)
                x = CENTER + r * math.cos(angle)
                y = CENTER + r * math.sin(angle)
                vertices.append((x, y))
            vertices.append(vertices[0])  # 闭合

            draw_smooth_line(d, vertices, WHITE_A(alpha), w)

        # 奇点
        draw_dot(d, CENTER, CENTER, 28, WHITE)

    finalize_fast(draw, 'v2d_light_cone_diamond')


# ═══════════════════════════════════════════════════════════
# 概念 E：引力偏折 (Gravitational Deflection)
# ═══════════════════════════════════════════════════════════
# 物理隐喻：广义相对论最经典的预言 —— 光线经过大质量天体附近时被偏折
# 5-7 条原本平行的竖直线，在中心区域被"吸引"弯向中心点
# 越靠近中心偏折越大，最中间的线几乎被完全拉向奇点
# 与现有 v2(测地线) 的区别：v2 的线从外到内是径向的，这里的线是原本平行的、被侧向偏折的
# 与"元初"品牌的关联：原初黑洞弯曲了周围的光线，留下第一个引力偏折的印记
#
# Physics: gravitational deflection of light — the classic prediction of General Relativity
# Parallel vertical lines bent toward the center, stronger near the singularity
# Suggests the invisible mass at center warping surrounding straight paths

def v2e_gravitational_deflection():
    def draw(d):
        # 7 条竖直线的初始 x 位置（加大间距，覆盖更多画布）
        offsets = [-480, -320, -160, 0, 160, 320, 480]
        y_range = 750       # 线条从 CENTER-750 到 CENTER+750
        strength = 900      # 偏折强度（经调参，使最内侧线弯曲约一半距离）

        for idx, x0_off in enumerate(offsets):
            x0 = CENTER + x0_off
            points = []

            for y in range(CENTER - y_range, CENTER + y_range + 1, 2):
                dy = y - CENTER
                if x0_off == 0:
                    dx = 0
                else:
                    dist_sq = x0_off * x0_off + dy * dy
                    dist_pow = dist_sq ** 0.75
                    if dist_pow < 1:
                        dist_pow = 1
                    dx = -strength * x0_off / dist_pow

                points.append((x0 + dx, y))

            # Alpha 根据距中心距离递减
            if x0_off == 0:
                alpha = 240
            else:
                alpha = max(110, 240 - int(abs(x0_off) / 3.0))

            w = NORMAL if x0_off == 0 else THIN
            draw_smooth_line(d, points, WHITE_A(alpha), w)

        # 奇点
        draw_dot(d, CENTER, CENTER, 28, WHITE)

    finalize_fast(draw, 'v2e_gravitational_deflection')


# ── Main ──
if __name__ == '__main__':
    print('=' * 55)
    print('YuanChu AI Logo Generator — V2 Edition')
    print('=' * 55)
    print()
    print('概念 A: 引力透镜位移 — 双圆偏移暗示爱因斯坦环')
    v2a_gravitational_displacement()

    print('概念 B: 史瓦西喉 — 弗拉姆抛物面剖面图')
    v2b_schwarzschild_throat()

    print('概念 C: 递生 — 道生一二三，弧线层级递进')
    v2c_tao_emergence()

    print('概念 D: 光锥钻石 — 彭罗斯因果图嵌套菱形')
    v2d_light_cone_diamond()

    print('概念 E: 引力偏折 — 平行光线被引力弯曲')
    v2e_gravitational_deflection()

    print()
    print('=' * 55)
    print(f'Done! 10 PNG files generated in {OUTPUT_DIR}')
    print('=' * 55)
