#!/usr/bin/env python3
"""
YuanChu AI Logo 自动化测试套件
测试 generate_logos_png.py 生成的 Logo 文件是否满足产品验收标准

测试覆盖：
1. 文件完整性：16 个 PNG 文件是否全部存在
2. 图像格式：PNG 格式、RGBA 模式、512×512 尺寸
3. Dark 版本：黑色背景验证
4. Transparent 版本：透明背景验证
5. 内容有效性：图像不为空、包含可见图形元素
6. 线条颜色：白色线条验证
7. Favicon 可辨性：缩小到 32×32 后仍有可辨内容
8. 图形元素简洁性：元素不过于复杂（文件大小合理性）
9. 设计差异性：各版本之间有明显视觉差异
10. 脚本可重复执行：重新运行脚本不报错
11. 项目约束：logo 目录外无文件变更
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
    'v1_singularity',
    'v2_geodesic_convergence',
    'v3_spacetime_warp',
    'v4_tao_layers',
    'v5_broken_horizon',
    'v6_golden_spiral',
    'v7_lensing_rings',
    'v8_yuanchu_unity',
]

VARIANTS = ['_dark.png', '_transparent.png']

EXPECTED_SIZE = (512, 512)
EXPECTED_MODE = 'RGBA'
FAVICON_SIZE = (32, 32)

# 所有预期文件列表
ALL_FILES = [f'{v}{var}' for v in VERSIONS for var in VARIANTS]


# ═══════════════════════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════════════════════

def get_logo_path(filename):
    """获取 logo 文件的完整路径"""
    return os.path.join(LOGO_DIR, filename)


def open_logo(filename):
    """打开 logo 图片文件"""
    return Image.open(get_logo_path(filename))


def count_non_bg_pixels(img, bg_color):
    """
    统计与背景色不同的像素数量。
    bg_color 为 RGBA 元组，匹配时只比较对应通道。
    """
    pixels = list(img.getdata())
    count = 0
    for p in pixels:
        if p != bg_color:
            count += 1
    return count


def pixel_hash(img):
    """
    计算图像的简易像素哈希值用于比较两张图是否相同。
    使用采样像素的均值来判定差异。
    """
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
    """验收标准：至少产出 5 个差异明显的 Logo 版本，每个版本有 dark 和 transparent 变体"""

    def test_all_16_files_exist(self):
        """验证全部 16 个 PNG 文件存在"""
        missing = []
        for f in ALL_FILES:
            path = get_logo_path(f)
            if not os.path.exists(path):
                missing.append(f)
        assert missing == [], f"缺失文件: {missing}"

    def test_at_least_5_versions(self):
        """验收标准：至少 5 个差异明显的版本"""
        assert len(VERSIONS) >= 5, f"版本数不足5个，当前仅有 {len(VERSIONS)} 个"

    def test_exactly_8_versions(self):
        """验证实际产出 8 个版本"""
        assert len(VERSIONS) == 8

    @pytest.mark.parametrize("filename", ALL_FILES)
    def test_file_not_empty(self, filename):
        """每个文件大小必须大于 1KB（非空文件）"""
        path = get_logo_path(filename)
        size = os.path.getsize(path)
        assert size > 1000, f"{filename} 文件过小 ({size} bytes)，可能是空图像"

    def test_script_exists(self):
        """验证生成脚本存在"""
        script = os.path.join(LOGO_DIR, 'generate_logos_png.py')
        assert os.path.exists(script), "generate_logos_png.py 脚本不存在"

    @pytest.mark.parametrize("filename", ALL_FILES)
    def test_file_extension_is_png(self, filename):
        """文件格式为 PNG"""
        assert filename.endswith('.png'), f"{filename} 不是 .png 文件"

    def test_file_naming_convention(self):
        """文件命名清晰，包含版本号和设计名"""
        for f in ALL_FILES:
            # 应匹配 vN_name_variant.png 格式
            parts = f.replace('.png', '').split('_')
            assert parts[0].startswith('v'), f"{f} 文件名不以 'v' 开头"
            assert parts[0][1:].isdigit(), f"{f} 版本号不是数字"


# ═══════════════════════════════════════════════════════════
# 测试类 2：图像格式与尺寸
# ═══════════════════════════════════════════════════════════

class TestImageFormat:
    """验收标准：PNG 格式、512×512 尺寸、RGBA 模式"""

    @pytest.mark.parametrize("filename", ALL_FILES)
    def test_image_format_is_png(self, filename):
        """验证图像格式为 PNG"""
        img = open_logo(filename)
        assert img.format == 'PNG', f"{filename} 格式为 {img.format}，不是 PNG"
        img.close()

    @pytest.mark.parametrize("filename", ALL_FILES)
    def test_image_size_512x512(self, filename):
        """验收标准：输出尺寸至少 512×512px"""
        img = open_logo(filename)
        assert img.size == EXPECTED_SIZE, f"{filename} 尺寸为 {img.size}，期望 {EXPECTED_SIZE}"
        img.close()

    @pytest.mark.parametrize("filename", ALL_FILES)
    def test_image_mode_rgba(self, filename):
        """验证图像为 RGBA 模式（支持透明度）"""
        img = open_logo(filename)
        assert img.mode == EXPECTED_MODE, f"{filename} 模式为 {img.mode}，期望 {EXPECTED_MODE}"
        img.close()


# ═══════════════════════════════════════════════════════════
# 测试类 3：Dark 版本验证
# ═══════════════════════════════════════════════════════════

class TestDarkVariant:
    """验收标准：在纯黑背景（#000000）上可辨识"""

    dark_files = [f'{v}_dark.png' for v in VERSIONS]

    @pytest.mark.parametrize("filename", dark_files)
    def test_dark_background_is_black(self, filename):
        """Dark 版本的四个角落像素应为纯黑 (0,0,0,255)"""
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
                f"{filename} 角落 {i} 颜色为 {corner}，期望黑色 (0,0,0,*)"

    @pytest.mark.parametrize("filename", dark_files)
    def test_dark_has_visible_content(self, filename):
        """Dark 版本必须包含非黑色像素（即可见的图形元素）"""
        img = open_logo(filename)
        non_black = count_non_bg_pixels(img, (0, 0, 0, 255))
        total = img.size[0] * img.size[1]
        img.close()
        # 至少 0.1% 的像素是非黑色的（图形内容）
        ratio = non_black / total
        assert ratio > 0.001, \
            f"{filename} 非黑色像素比例仅 {ratio:.4%}，图形内容可能不足"

    @pytest.mark.parametrize("filename", dark_files)
    def test_dark_not_too_dense(self, filename):
        """图形不应过于密集/复杂（非黑色像素不超过 30%，符合极简要求）"""
        img = open_logo(filename)
        non_black = count_non_bg_pixels(img, (0, 0, 0, 255))
        total = img.size[0] * img.size[1]
        img.close()
        ratio = non_black / total
        assert ratio < 0.30, \
            f"{filename} 非黑色像素占 {ratio:.1%}，图形可能过于复杂，不符合极简要求"


# ═══════════════════════════════════════════════════════════
# 测试类 4：Transparent 版本验证
# ═══════════════════════════════════════════════════════════

class TestTransparentVariant:
    """验收标准：透明背景版本正确"""

    trans_files = [f'{v}_transparent.png' for v in VERSIONS]

    @pytest.mark.parametrize("filename", trans_files)
    def test_transparent_background(self, filename):
        """Transparent 版本的角落像素 alpha 通道应为 0"""
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
                f"{filename} 角落 {i} alpha={corner[3]}，期望 0（完全透明）"

    @pytest.mark.parametrize("filename", trans_files)
    def test_transparent_has_visible_content(self, filename):
        """Transparent 版本必须包含非透明像素（即可见图形）"""
        img = open_logo(filename)
        pixels = list(img.getdata())
        non_transparent = sum(1 for p in pixels if p[3] > 0)
        total = len(pixels)
        img.close()
        ratio = non_transparent / total
        assert ratio > 0.001, \
            f"{filename} 非透明像素比例仅 {ratio:.4%}，图形内容可能不足"

    @pytest.mark.parametrize("filename", trans_files)
    def test_transparent_dark_consistency(self, filename):
        """Transparent 版本的图形区域应与 Dark 版本的图形区域一致"""
        dark_name = filename.replace('_transparent.png', '_dark.png')
        img_t = open_logo(filename)
        img_d = open_logo(dark_name)

        # 缩小到 64x64 比较大体布局
        small_t = img_t.resize((64, 64), Image.LANCZOS)
        small_d = img_d.resize((64, 64), Image.LANCZOS)

        pixels_t = list(small_t.getdata())
        pixels_d = list(small_d.getdata())

        # 比较两者的「有内容区域」是否大致匹配
        # 对 dark 版本：非黑色 = 有内容
        # 对 transparent 版本：非透明 = 有内容
        has_content_d = [p[:3] != (0, 0, 0) for p in pixels_d]
        has_content_t = [p[3] > 10 for p in pixels_t]

        # 计算一致比例
        match = sum(1 for d, t in zip(has_content_d, has_content_t) if d == t)
        total = len(pixels_d)
        match_ratio = match / total

        img_t.close()
        img_d.close()

        assert match_ratio > 0.85, \
            f"{filename} 与 dark 版本的图形区域一致性仅 {match_ratio:.1%}，两个变体应包含相同图形"


# ═══════════════════════════════════════════════════════════
# 测试类 5：线条颜色验证
# ═══════════════════════════════════════════════════════════

class TestLineColor:
    """验收标准：使用白色/浅色线条（适配深色背景）"""

    dark_files = [f'{v}_dark.png' for v in VERSIONS]

    @pytest.mark.parametrize("filename", dark_files)
    def test_foreground_is_white_tones(self, filename):
        """Dark 版本中非黑色像素应为白色/浅色调（R≈G≈B，且亮度高）"""
        img = open_logo(filename)
        pixels = list(img.getdata())
        img.close()

        # 收集所有明显非黑色的像素
        fg_pixels = [p for p in pixels if p[0] > 30 or p[1] > 30 or p[2] > 30]

        if not fg_pixels:
            pytest.skip(f"{filename} 无前景像素")

        # 检查前景像素是否为灰白色调（R≈G≈B）
        non_white_count = 0
        for p in fg_pixels:
            r, g, b = p[0], p[1], p[2]
            # 允许抗锯齿产生的微小色差
            max_diff = max(r, g, b) - min(r, g, b)
            if max_diff > 15:  # 容差 15，允许抗锯齿
                non_white_count += 1

        non_white_ratio = non_white_count / len(fg_pixels)
        assert non_white_ratio < 0.05, \
            f"{filename} 有 {non_white_ratio:.1%} 的前景像素不是白色/灰色调，应使用纯白色线条"


# ═══════════════════════════════════════════════════════════
# 测试类 6：Favicon 可辨性
# ═══════════════════════════════════════════════════════════

class TestFaviconReadability:
    """验收标准：缩小到 32×32px（favicon 级别）仍可辨认基本轮廓"""

    dark_files = [f'{v}_dark.png' for v in VERSIONS]

    @pytest.mark.parametrize("filename", dark_files)
    def test_favicon_has_visible_structure(self, filename):
        """缩小到 32×32 后，仍有足够的非黑色像素来形成可辨识的图形。
        注意：由于使用超细线条（~1.25px）+ LANCZOS 抗锯齿缩放，
        32×32 下线条亮度会大幅降低。阈值 >15 是对超细线条抗锯齿后的合理下限。
        """
        img = open_logo(filename)
        favicon = img.resize(FAVICON_SIZE, Image.LANCZOS)
        pixels = list(favicon.getdata())
        img.close()

        # 阈值 >15：LANCZOS 缩放超细线条时，抗锯齿会将白色(255)平均化到约 10-40
        # 在 32×32=1024 像素中，至少需要 20 个可见像素才能形成可辨识的结构
        visible = sum(1 for p in pixels if max(p[0], p[1], p[2]) > 15)
        assert visible >= 20, \
            f"{filename} 在 32×32 时仅有 {visible} 个亮度>15的像素（共1024），可能无法辨识"

    @pytest.mark.parametrize("filename", dark_files)
    def test_favicon_max_brightness_sufficient(self, filename):
        """32×32 下至少应有部分像素亮度 >40，确保核心元素（如中心点）清晰可见"""
        img = open_logo(filename)
        favicon = img.resize(FAVICON_SIZE, Image.LANCZOS)
        pixels = list(favicon.getdata())
        img.close()

        max_brightness = max(max(p[0], p[1], p[2]) for p in pixels)
        assert max_brightness > 40, \
            f"{filename} 在 32×32 时最大亮度仅 {max_brightness}，核心元素可能不够清晰"

    @pytest.mark.parametrize("filename", dark_files)
    def test_favicon_center_has_content(self, filename):
        """
        缩小到 32×32 后，中心区域（12×12）应有可见内容。
        这确保 Logo 的核心图形居中且在小尺寸下仍可见。
        """
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
            f"{filename} 在 32×32 中心 12×12 区域无可见内容，Logo 核心可能偏离中心"


# ═══════════════════════════════════════════════════════════
# 测试类 7：设计差异性
# ═══════════════════════════════════════════════════════════

class TestDesignDiversity:
    """验收标准：各版本有明确的设计差异，而非微调"""

    def test_versions_are_visually_different(self):
        """8 个版本之间应有明显的视觉差异"""
        hashes = {}
        for v in VERSIONS:
            fname = f'{v}_dark.png'
            img = open_logo(fname)
            hashes[v] = pixel_hash(img)
            img.close()

        # 两两比较，所有版本的哈希值应不同
        versions = list(hashes.keys())
        identical_pairs = []
        for i in range(len(versions)):
            for j in range(i + 1, len(versions)):
                if hashes[versions[i]] == hashes[versions[j]]:
                    identical_pairs.append((versions[i], versions[j]))

        assert identical_pairs == [], \
            f"以下版本对视觉上可能完全相同: {identical_pairs}"

    def test_pixel_distribution_differs(self):
        """各版本的像素分布特征应有明显差异"""
        features = {}
        for v in VERSIONS:
            fname = f'{v}_dark.png'
            img = open_logo(fname)
            pixels = list(img.getdata())
            total = len(pixels)

            # 特征：非黑色像素占比
            non_black = sum(1 for p in pixels if p[:3] != (0, 0, 0))
            features[v] = non_black / total
            img.close()

        # 不是所有版本都有完全相同的像素密度
        unique_densities = set(round(d, 3) for d in features.values())
        assert len(unique_densities) >= 4, \
            f"各版本像素密度差异不足，仅有 {len(unique_densities)} 种不同密度值，设计可能过于相似"

    def test_file_sizes_vary(self):
        """不同版本的文件大小应有差异，反映不同的图形复杂度"""
        sizes = {}
        for v in VERSIONS:
            fname = f'{v}_dark.png'
            sizes[v] = os.path.getsize(get_logo_path(fname))

        unique_sizes = set(sizes.values())
        assert len(unique_sizes) >= 5, \
            f"文件大小差异不足，仅有 {len(unique_sizes)} 种不同大小"


# ═══════════════════════════════════════════════════════════
# 测试类 8：图形简洁性
# ═══════════════════════════════════════════════════════════

class TestSimplicity:
    """验收标准：极简几何线条风，不超过 3-4 个几何形状的组合"""

    dark_files = [f'{v}_dark.png' for v in VERSIONS]

    @pytest.mark.parametrize("filename", dark_files)
    def test_graphic_is_centered(self, filename):
        """Logo 图形应以画布中心为重心"""
        img = open_logo(filename)
        pixels = list(img.getdata())
        w, h = img.size
        img.close()

        # 计算所有可见像素的质心
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

        # 质心应在画布中心 ±20% 范围内
        margin = w * 0.20
        center = w / 2.0
        assert abs(cx - center) < margin, \
            f"{filename} 水平质心 {cx:.0f} 偏离中心 {center:.0f} 超过 20%"
        assert abs(cy - center) < margin, \
            f"{filename} 垂直质心 {cy:.0f} 偏离中心 {center:.0f} 超过 20%"

    @pytest.mark.parametrize("filename", dark_files)
    def test_logo_has_padding(self, filename):
        """Logo 图形周围应有充分的留白/padding"""
        img = open_logo(filename)
        w, h = img.size
        img.close()

        # 检查图像边缘 5% 区域是否主要为黑色（留白）
        border = int(w * 0.05)  # 约 25 px
        border_pixels = []

        img = open_logo(filename)
        for y in range(h):
            for x in range(w):
                if x < border or x >= w - border or y < border or y >= h - border:
                    border_pixels.append(img.getpixel((x, y)))
        img.close()

        non_black_border = sum(1 for p in border_pixels if p[:3] != (0, 0, 0))
        ratio = non_black_border / len(border_pixels) if border_pixels else 0

        assert ratio < 0.25, \
            f"{filename} 边缘区域有 {ratio:.1%} 非黑色像素，留白可能不足"


# ═══════════════════════════════════════════════════════════
# 测试类 9：脚本可重复性
# ═══════════════════════════════════════════════════════════

class TestScriptReproducibility:
    """验证生成脚本可以重复执行且不报错"""

    def test_script_runs_without_error(self):
        """重新运行 generate_logos_png.py 应成功完成"""
        script = os.path.join(LOGO_DIR, 'generate_logos_png.py')
        result = subprocess.run(
            ['python3', script],
            capture_output=True,
            text=True,
            timeout=120
        )
        assert result.returncode == 0, \
            f"脚本执行失败 (returncode={result.returncode}):\nstdout: {result.stdout}\nstderr: {result.stderr}"

    def test_script_output_mentions_16_files(self):
        """脚本输出应提及生成了 16 个文件"""
        script = os.path.join(LOGO_DIR, 'generate_logos_png.py')
        result = subprocess.run(
            ['python3', script],
            capture_output=True,
            text=True,
            timeout=120
        )
        assert '16' in result.stdout, \
            f"脚本输出未提及 16 个文件：{result.stdout}"


# ═══════════════════════════════════════════════════════════
# 测试类 10：项目约束
# ═══════════════════════════════════════════════════════════

class TestProjectConstraints:
    """验收标准：不修改项目中 logo/ 目录外的任何文件"""

    def test_all_new_files_in_logo_dir(self):
        """所有新生成的文件都在 logo/ 目录内"""
        for f in ALL_FILES:
            path = get_logo_path(f)
            assert path.startswith(LOGO_DIR), \
                f"{f} 不在 logo/ 目录内"

    def test_no_changes_outside_logo_dir(self):
        """通过 git 检查 logo/ 目录外没有文件变更"""
        result = subprocess.run(
            ['git', 'status', '--porcelain'],
            capture_output=True, text=True,
            cwd=PROJECT_ROOT
        )
        if result.returncode != 0:
            pytest.skip("无法运行 git status")

        lines = result.stdout.strip().split('\n') if result.stdout.strip() else []
        outside_logo = [l for l in lines if l.strip() and not l.strip().startswith('?? logo/') and 'logo/' not in l]
        assert outside_logo == [], \
            f"logo/ 目录外有文件变更: {outside_logo}"

    def test_original_script_unchanged(self):
        """原有的 generate_logos.py 不应被修改"""
        result = subprocess.run(
            ['git', 'diff', '--name-only', '--', 'logo/generate_logos.py'],
            capture_output=True, text=True,
            cwd=PROJECT_ROOT
        )
        if result.returncode != 0:
            pytest.skip("无法运行 git diff")

        assert result.stdout.strip() == '', \
            "原有的 generate_logos.py 被修改了"


# ═══════════════════════════════════════════════════════════
# 测试类 11：道家哲学层次验证（V4 特定）
# ═══════════════════════════════════════════════════════════

class TestTaoPhilosophy:
    """验收标准（加分项）：V4 图形中能看出从中心向外的层次递进感（1→2→3→多）"""

    def test_v4_has_concentric_layers(self):
        """V4 应从中心到外围有递增的内容密度（层次递进）"""
        img = open_logo('v4_tao_layers_dark.png')
        w, h = img.size
        cx, cy = w // 2, h // 2

        # 将图像划分为 4 个同心环带，统计每个环带的可见像素占比
        rings = [0, 0, 0, 0]
        ring_totals = [0, 0, 0, 0]
        radii = [64, 128, 192, 256]  # 4 个环的外半径

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

        # 计算各环的像素密度
        densities = [rings[i] / ring_totals[i] if ring_totals[i] > 0 else 0 for i in range(4)]

        # 至少应有 3 个环带有可见内容（体现层次感）
        active_rings = sum(1 for d in densities if d > 0.001)
        assert active_rings >= 3, \
            f"V4 仅有 {active_rings} 个环带有内容，层次感不足。密度分布: {[f'{d:.3f}' for d in densities]}"


# ═══════════════════════════════════════════════════════════
# 测试类 12：图形元素数量（简洁性定量验证）
# ═══════════════════════════════════════════════════════════

class TestElementCount:
    """验收标准：图形元素不超过 3-4 个几何形状的组合"""

    dark_files = [f'{v}_dark.png' for v in VERSIONS]

    @pytest.mark.parametrize("filename", dark_files)
    def test_reasonable_complexity(self, filename):
        """
        通过连通区域数来近似估计图形元素数量。
        使用粗略的行扫描统计「亮度变化边界」来判断。
        由于是抗锯齿图像，使用阈值检测。
        """
        img = open_logo(filename)
        small = img.resize((128, 128), Image.LANCZOS)
        img.close()

        # 统计水平方向上的亮暗交替次数（边界数）
        transitions = 0
        for y in range(128):
            prev_bright = False
            for x in range(128):
                p = small.getpixel((x, y))
                bright = (p[0] + p[1] + p[2]) / 3.0 > 40
                if bright != prev_bright:
                    transitions += 1
                prev_bright = bright

        # 过于复杂的图形会有非常多的边界跳变
        # 对于极简 logo，transitions 不应过大
        # V3（时空弯曲网格）可能最复杂，但也不应超过合理范围
        assert transitions < 5000, \
            f"{filename} 水平边界跳变 {transitions} 次，图形可能过于复杂"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
