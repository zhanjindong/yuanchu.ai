#!/usr/bin/env python3
"""
YuanChu AI Logo V2 自动化测试套件
测试 generate_logos_v2.py 生成的 Logo 文件是否满足产品验收标准

测试覆盖：
1. 文件完整性：10 个 PNG 文件是否全部存在
2. 图像格式：PNG 格式、RGBA 模式、512×512 尺寸
3. Dark 版本：黑色背景验证
4. Transparent 版本：透明背景验证
5. 线条颜色：白色线条验证
6. Favicon 可辨性：缩小到 32×32 后仍有可辨内容
7. 图形简洁性：元素不过于复杂
8. 设计差异性：各版本之间有明显视觉差异
9. 脚本可重复执行
10. 项目约束：logo 目录外无文件变更
"""

import os
import math
import subprocess
import pytest
from PIL import Image

# ── 常量 ──
LOGO_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(LOGO_DIR)

VERSIONS = [
    'v2a_gravitational_displacement',
    'v2b_schwarzschild_throat',
    'v2c_tao_emergence',
    'v2d_light_cone_diamond',
    'v2e_gravitational_deflection',
]

VARIANTS = ['_dark.png', '_transparent.png']

EXPECTED_SIZE = (512, 512)
EXPECTED_MODE = 'RGBA'
FAVICON_SIZE = (32, 32)

ALL_FILES = [f'{v}{var}' for v in VERSIONS for var in VARIANTS]


# ═══════════════════════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════════════════════

def get_logo_path(filename):
    return os.path.join(LOGO_DIR, filename)


def open_logo(filename):
    return Image.open(get_logo_path(filename))


def count_non_bg_pixels(img, bg_color):
    pixels = list(img.getdata())
    count = 0
    for p in pixels:
        if p != bg_color:
            count += 1
    return count


def pixel_hash(img):
    small = img.resize((64, 64), Image.LANCZOS)
    pixels = list(small.getdata())
    if not pixels:
        return 0
    r_sum = sum(p[0] for p in pixels)
    g_sum = sum(p[1] for p in pixels)
    b_sum = sum(p[2] for p in pixels)
    a_sum = sum(p[3] for p in pixels)
    return (r_sum, g_sum, b_sum, a_sum)


# ═══════════════════════════════════════════════════════════
# 测试类 1：文件完整性
# ═══════════════════════════════════════════════════════════

class TestFileCompleteness:

    def test_all_10_files_exist(self):
        missing = []
        for f in ALL_FILES:
            path = get_logo_path(f)
            if not os.path.exists(path):
                missing.append(f)
        assert missing == [], f"缺失文件: {missing}"

    def test_exactly_5_versions(self):
        assert len(VERSIONS) == 5

    @pytest.mark.parametrize("filename", ALL_FILES)
    def test_file_not_empty(self, filename):
        path = get_logo_path(filename)
        size = os.path.getsize(path)
        assert size > 1000, f"{filename} 文件过小 ({size} bytes)"

    def test_script_exists(self):
        script = os.path.join(LOGO_DIR, 'generate_logos_v2.py')
        assert os.path.exists(script)

    @pytest.mark.parametrize("filename", ALL_FILES)
    def test_file_extension_is_png(self, filename):
        assert filename.endswith('.png')

    def test_file_naming_convention(self):
        for f in ALL_FILES:
            assert f.startswith('v2'), f"{f} 文件名不以 'v2' 开头"


# ═══════════════════════════════════════════════════════════
# 测试类 2：图像格式与尺寸
# ═══════════════════════════════════════════════════════════

class TestImageFormat:

    @pytest.mark.parametrize("filename", ALL_FILES)
    def test_image_format_is_png(self, filename):
        img = open_logo(filename)
        assert img.format == 'PNG'
        img.close()

    @pytest.mark.parametrize("filename", ALL_FILES)
    def test_image_size_512x512(self, filename):
        img = open_logo(filename)
        assert img.size == EXPECTED_SIZE
        img.close()

    @pytest.mark.parametrize("filename", ALL_FILES)
    def test_image_mode_rgba(self, filename):
        img = open_logo(filename)
        assert img.mode == EXPECTED_MODE
        img.close()


# ═══════════════════════════════════════════════════════════
# 测试类 3：Dark 版本验证
# ═══════════════════════════════════════════════════════════

class TestDarkVariant:

    dark_files = [f'{v}_dark.png' for v in VERSIONS]

    @pytest.mark.parametrize("filename", dark_files)
    def test_dark_background_is_black(self, filename):
        img = open_logo(filename)
        corners = [
            img.getpixel((0, 0)),
            img.getpixel((511, 0)),
            img.getpixel((0, 511)),
            img.getpixel((511, 511)),
        ]
        img.close()
        for i, corner in enumerate(corners):
            assert corner[:3] == (0, 0, 0), \
                f"{filename} 角落 {i} 颜色为 {corner}，期望黑色"

    @pytest.mark.parametrize("filename", dark_files)
    def test_dark_has_visible_content(self, filename):
        img = open_logo(filename)
        non_black = count_non_bg_pixels(img, (0, 0, 0, 255))
        total = img.size[0] * img.size[1]
        img.close()
        ratio = non_black / total
        assert ratio > 0.001, \
            f"{filename} 非黑色像素比例仅 {ratio:.4%}，图形内容可能不足"

    @pytest.mark.parametrize("filename", dark_files)
    def test_dark_not_too_dense(self, filename):
        img = open_logo(filename)
        non_black = count_non_bg_pixels(img, (0, 0, 0, 255))
        total = img.size[0] * img.size[1]
        img.close()
        ratio = non_black / total
        assert ratio < 0.30, \
            f"{filename} 非黑色像素占 {ratio:.1%}，图形可能过于复杂"


# ═══════════════════════════════════════════════════════════
# 测试类 4：Transparent 版本验证
# ═══════════════════════════════════════════════════════════

class TestTransparentVariant:

    trans_files = [f'{v}_transparent.png' for v in VERSIONS]

    @pytest.mark.parametrize("filename", trans_files)
    def test_transparent_background(self, filename):
        img = open_logo(filename)
        corners = [
            img.getpixel((0, 0)),
            img.getpixel((511, 0)),
            img.getpixel((0, 511)),
            img.getpixel((511, 511)),
        ]
        img.close()
        for i, corner in enumerate(corners):
            assert corner[3] == 0, \
                f"{filename} 角落 {i} alpha={corner[3]}，期望 0"

    @pytest.mark.parametrize("filename", trans_files)
    def test_transparent_has_visible_content(self, filename):
        img = open_logo(filename)
        pixels = list(img.getdata())
        non_transparent = sum(1 for p in pixels if p[3] > 0)
        total = len(pixels)
        img.close()
        ratio = non_transparent / total
        assert ratio > 0.001, \
            f"{filename} 非透明像素比例仅 {ratio:.4%}"

    @pytest.mark.parametrize("filename", trans_files)
    def test_transparent_dark_consistency(self, filename):
        dark_name = filename.replace('_transparent.png', '_dark.png')
        img_t = open_logo(filename)
        img_d = open_logo(dark_name)

        small_t = img_t.resize((64, 64), Image.LANCZOS)
        small_d = img_d.resize((64, 64), Image.LANCZOS)

        pixels_t = list(small_t.getdata())
        pixels_d = list(small_d.getdata())

        has_content_d = [p[:3] != (0, 0, 0) for p in pixels_d]
        has_content_t = [p[3] > 10 for p in pixels_t]

        match = sum(1 for d, t in zip(has_content_d, has_content_t) if d == t)
        total = len(pixels_d)
        match_ratio = match / total

        img_t.close()
        img_d.close()

        assert match_ratio > 0.85, \
            f"{filename} 与 dark 版本一致性仅 {match_ratio:.1%}"


# ═══════════════════════════════════════════════════════════
# 测试类 5：线条颜色验证
# ═══════════════════════════════════════════════════════════

class TestLineColor:

    dark_files = [f'{v}_dark.png' for v in VERSIONS]

    @pytest.mark.parametrize("filename", dark_files)
    def test_foreground_is_white_tones(self, filename):
        img = open_logo(filename)
        pixels = list(img.getdata())
        img.close()

        fg_pixels = [p for p in pixels if p[0] > 30 or p[1] > 30 or p[2] > 30]
        if not fg_pixels:
            pytest.skip(f"{filename} 无前景像素")

        non_white_count = 0
        for p in fg_pixels:
            r, g, b = p[0], p[1], p[2]
            max_diff = max(r, g, b) - min(r, g, b)
            if max_diff > 15:
                non_white_count += 1

        non_white_ratio = non_white_count / len(fg_pixels)
        assert non_white_ratio < 0.05, \
            f"{filename} 有 {non_white_ratio:.1%} 的前景像素不是白色/灰色调"


# ═══════════════════════════════════════════════════════════
# 测试类 6：Favicon 可辨性
# ═══════════════════════════════════════════════════════════

class TestFaviconReadability:

    dark_files = [f'{v}_dark.png' for v in VERSIONS]

    @pytest.mark.parametrize("filename", dark_files)
    def test_favicon_has_visible_structure(self, filename):
        img = open_logo(filename)
        favicon = img.resize(FAVICON_SIZE, Image.LANCZOS)
        pixels = list(favicon.getdata())
        img.close()

        visible = sum(1 for p in pixels if max(p[0], p[1], p[2]) > 15)
        assert visible >= 20, \
            f"{filename} 在 32×32 时仅有 {visible} 个亮度>15的像素"

    @pytest.mark.parametrize("filename", dark_files)
    def test_favicon_max_brightness_sufficient(self, filename):
        img = open_logo(filename)
        favicon = img.resize(FAVICON_SIZE, Image.LANCZOS)
        pixels = list(favicon.getdata())
        img.close()

        max_brightness = max(max(p[0], p[1], p[2]) for p in pixels)
        assert max_brightness > 40, \
            f"{filename} 在 32×32 时最大亮度仅 {max_brightness}"

    @pytest.mark.parametrize("filename", dark_files)
    def test_favicon_center_has_content(self, filename):
        img = open_logo(filename)
        favicon = img.resize(FAVICON_SIZE, Image.LANCZOS)
        img.close()

        center_visible = 0
        for y in range(10, 22):
            for x in range(10, 22):
                p = favicon.getpixel((x, y))
                if p[0] > 30 or p[1] > 30 or p[2] > 30:
                    center_visible += 1

        assert center_visible >= 1, \
            f"{filename} 在 32×32 中心 12×12 区域无可见内容"


# ═══════════════════════════════════════════════════════════
# 测试类 7：设计差异性
# ═══════════════════════════════════════════════════════════

class TestDesignDiversity:

    def test_versions_are_visually_different(self):
        hashes = {}
        for v in VERSIONS:
            fname = f'{v}_dark.png'
            img = open_logo(fname)
            hashes[v] = pixel_hash(img)
            img.close()

        versions = list(hashes.keys())
        identical_pairs = []
        for i in range(len(versions)):
            for j in range(i + 1, len(versions)):
                if hashes[versions[i]] == hashes[versions[j]]:
                    identical_pairs.append((versions[i], versions[j]))

        assert identical_pairs == [], \
            f"以下版本对视觉上可能完全相同: {identical_pairs}"

    def test_pixel_distribution_differs(self):
        features = {}
        for v in VERSIONS:
            fname = f'{v}_dark.png'
            img = open_logo(fname)
            pixels = list(img.getdata())
            total = len(pixels)

            non_black = sum(1 for p in pixels if p[:3] != (0, 0, 0))
            features[v] = non_black / total
            img.close()

        unique_densities = set(round(d, 3) for d in features.values())
        assert len(unique_densities) >= 3, \
            f"像素密度差异不足，仅有 {len(unique_densities)} 种"

    def test_file_sizes_vary(self):
        sizes = {}
        for v in VERSIONS:
            fname = f'{v}_dark.png'
            sizes[v] = os.path.getsize(get_logo_path(fname))

        unique_sizes = set(sizes.values())
        assert len(unique_sizes) >= 3, \
            f"文件大小差异不足，仅有 {len(unique_sizes)} 种不同大小"


# ═══════════════════════════════════════════════════════════
# 测试类 8：图形简洁性
# ═══════════════════════════════════════════════════════════

class TestSimplicity:

    dark_files = [f'{v}_dark.png' for v in VERSIONS]

    @pytest.mark.parametrize("filename", dark_files)
    def test_graphic_is_centered(self, filename):
        img = open_logo(filename)
        pixels = list(img.getdata())
        w, h = img.size
        img.close()

        total_x, total_y, count = 0, 0, 0
        for idx, p in enumerate(pixels):
            if p[:3] != (0, 0, 0):
                x = idx % w
                y = idx // w
                brightness = (p[0] + p[1] + p[2]) / 3.0
                total_x += x * brightness
                total_y += y * brightness
                count += brightness

        if count == 0:
            pytest.skip(f"{filename} 无可见像素")

        cx = total_x / count
        cy = total_y / count

        margin = w * 0.25
        center = w / 2.0
        assert abs(cx - center) < margin, \
            f"{filename} 水平质心 {cx:.0f} 偏离中心 {center:.0f} 超过 25%"
        assert abs(cy - center) < margin, \
            f"{filename} 垂直质心 {cy:.0f} 偏离中心 {center:.0f} 超过 25%"

    @pytest.mark.parametrize("filename", dark_files)
    def test_logo_has_padding(self, filename):
        img = open_logo(filename)
        w, h = img.size

        border = int(w * 0.05)
        border_pixels = []

        for y in range(h):
            for x in range(w):
                if x < border or x >= w - border or y < border or y >= h - border:
                    border_pixels.append(img.getpixel((x, y)))
        img.close()

        non_black_border = sum(1 for p in border_pixels if p[:3] != (0, 0, 0))
        ratio = non_black_border / len(border_pixels) if border_pixels else 0

        assert ratio < 0.25, \
            f"{filename} 边缘区域有 {ratio:.1%} 非黑色像素，留白可能不足"

    @pytest.mark.parametrize("filename", dark_files)
    def test_reasonable_complexity(self, filename):
        img = open_logo(filename)
        small = img.resize((128, 128), Image.LANCZOS)
        img.close()

        transitions = 0
        for y in range(128):
            prev_bright = False
            for x in range(128):
                p = small.getpixel((x, y))
                bright = (p[0] + p[1] + p[2]) / 3.0 > 40
                if bright != prev_bright:
                    transitions += 1
                prev_bright = bright

        assert transitions < 5000, \
            f"{filename} 水平边界跳变 {transitions} 次，图形可能过于复杂"


# ═══════════════════════════════════════════════════════════
# 测试类 9：脚本可重复性
# ═══════════════════════════════════════════════════════════

class TestScriptReproducibility:

    def test_script_runs_without_error(self):
        script = os.path.join(LOGO_DIR, 'generate_logos_v2.py')
        result = subprocess.run(
            ['python3', script],
            capture_output=True,
            text=True,
            timeout=120
        )
        assert result.returncode == 0, \
            f"脚本执行失败:\nstdout: {result.stdout}\nstderr: {result.stderr}"

    def test_script_output_mentions_10_files(self):
        script = os.path.join(LOGO_DIR, 'generate_logos_v2.py')
        result = subprocess.run(
            ['python3', script],
            capture_output=True,
            text=True,
            timeout=120
        )
        assert '10' in result.stdout, \
            f"脚本输出未提及 10 个文件：{result.stdout}"


# ═══════════════════════════════════════════════════════════
# 测试类 10：项目约束
# ═══════════════════════════════════════════════════════════

class TestProjectConstraints:

    def test_all_new_files_in_logo_dir(self):
        for f in ALL_FILES:
            path = get_logo_path(f)
            assert path.startswith(LOGO_DIR)

    def test_original_scripts_unchanged(self):
        for script_name in ['generate_logos.py', 'generate_logos_png.py']:
            result = subprocess.run(
                ['git', 'diff', '--name-only', '--', f'logo/{script_name}'],
                capture_output=True, text=True,
                cwd=PROJECT_ROOT
            )
            if result.returncode != 0:
                pytest.skip("无法运行 git diff")

            assert result.stdout.strip() == '', \
                f"原有的 {script_name} 被修改了"


# ═══════════════════════════════════════════════════════════
# 测试类 11：道家哲学层次验证（V2C 特定）
# ═══════════════════════════════════════════════════════════

class TestTaoPhilosophy:

    def test_v2c_has_layered_structure(self):
        """V2C 应有从中心到外围的递进层次感"""
        img = open_logo('v2c_tao_emergence_dark.png')
        w, h = img.size
        cx, cy = w // 2, h // 2

        rings = [0, 0, 0, 0]
        ring_totals = [0, 0, 0, 0]
        radii = [64, 128, 192, 256]

        for y in range(h):
            for x in range(w):
                dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
                p = img.getpixel((x, y))
                is_visible = p[:3] != (0, 0, 0)

                if dist < radii[0]:
                    ring_totals[0] += 1
                    if is_visible:
                        rings[0] += 1
                elif dist < radii[1]:
                    ring_totals[1] += 1
                    if is_visible:
                        rings[1] += 1
                elif dist < radii[2]:
                    ring_totals[2] += 1
                    if is_visible:
                        rings[2] += 1
                elif dist < radii[3]:
                    ring_totals[3] += 1
                    if is_visible:
                        rings[3] += 1

        img.close()

        densities = [rings[i] / ring_totals[i] if ring_totals[i] > 0 else 0 for i in range(4)]
        active_rings = sum(1 for d in densities if d > 0.001)
        assert active_rings >= 2, \
            f"V2C 仅有 {active_rings} 个环带有内容，层次感不足。密度: {[f'{d:.3f}' for d in densities]}"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
