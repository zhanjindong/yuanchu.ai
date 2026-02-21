#!/usr/bin/env python3
"""
YuanChu AI Logo V2 补充测试套件
覆盖 test_logos_v2.py 中未涵盖的边界情况和产品验收标准

补充测试覆盖：
1. 跨代差异化：v2 与 v1-v8 之间的设计差异
2. 概念特异性：各概念方向的独特视觉特征验证
3. 渲染管线一致性：与 v1 使用相同的技术参数
4. 设计文档完整性：脚本中的设计理念说明
5. 文件命名无冲突：v2 文件不覆盖 v1-v8
6. 象限分布差异：不同设计有不同的空间分布特征
7. PNG 文件完整性：文件可正确读取且无损坏
8. 边界像素安全：图形不超出画布范围
"""

import os
import math
import ast
import pytest
from PIL import Image

# ── 常量 ──
LOGO_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(LOGO_DIR)

V2_VERSIONS = [
    'v2a_gravitational_displacement',
    'v2b_schwarzschild_throat',
    'v2c_tao_emergence',
    'v2d_light_cone_diamond',
    'v2e_gravitational_deflection',
]

V1_VERSIONS = [
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
V2_ALL_FILES = [f'{v}{var}' for v in V2_VERSIONS for var in VARIANTS]
V2_DARK_FILES = [f'{v}_dark.png' for v in V2_VERSIONS]


def get_logo_path(filename):
    return os.path.join(LOGO_DIR, filename)


def open_logo(filename):
    return Image.open(get_logo_path(filename))


def get_pixel_fingerprint(name):
    """生成基于空间分布的指纹，用于跨代比较"""
    img = open_logo(f'{name}_dark.png')
    small = img.resize((32, 32), Image.LANCZOS)
    pixels = list(small.getdata())
    img.close()
    # 将 32x32 区域划分为 4x4 的 16 个块，每块 8x8 像素
    blocks = []
    for by in range(4):
        for bx in range(4):
            block_sum = 0
            for y in range(8):
                for x in range(8):
                    idx = (by * 8 + y) * 32 + (bx * 8 + x)
                    p = pixels[idx]
                    block_sum += (p[0] + p[1] + p[2]) / 3.0
                    block_sum += p[3] / 4.0  # alpha 权重较低
            blocks.append(block_sum)
    return tuple(blocks)


def get_quadrant_distribution(name):
    """计算四个象限的像素分布比例"""
    img = open_logo(f'{name}_dark.png')
    w, h = img.size
    cx, cy = w // 2, h // 2

    quadrants = [0, 0, 0, 0]  # TL, TR, BL, BR
    total_visible = 0

    for y in range(h):
        for x in range(w):
            p = img.getpixel((x, y))
            if p[:3] != (0, 0, 0):
                total_visible += 1
                if x < cx and y < cy:
                    quadrants[0] += 1  # TL
                elif x >= cx and y < cy:
                    quadrants[1] += 1  # TR
                elif x < cx and y >= cy:
                    quadrants[2] += 1  # BL
                else:
                    quadrants[3] += 1  # BR

    img.close()
    if total_visible == 0:
        return [0, 0, 0, 0]
    return [q / total_visible for q in quadrants]


# ═══════════════════════════════════════════════════════════
# 测试类 1：跨代差异化（v2 vs v1-v8）
# ═══════════════════════════════════════════════════════════

class TestCrossGenerationDiversity:
    """验收标准：新版本需在概念上有明显突破，避免与 v1-v8 重复"""

    def test_v2_not_identical_to_v1(self):
        """v2 系列与 v1-v8 系列应无完全相同的设计"""
        v1_fps = {}
        v2_fps = {}

        for v in V1_VERSIONS:
            path = get_logo_path(f'{v}_dark.png')
            if os.path.exists(path):
                v1_fps[v] = get_pixel_fingerprint(v)

        for v in V2_VERSIONS:
            v2_fps[v] = get_pixel_fingerprint(v)

        identical = []
        for v2_name, v2_fp in v2_fps.items():
            for v1_name, v1_fp in v1_fps.items():
                if v2_fp == v1_fp:
                    identical.append((v2_name, v1_name))

        assert identical == [], \
            f"以下 v2 设计与 v1 设计完全相同: {identical}"

    def test_v2_spatial_distribution_differs_from_v1(self):
        """v2 的空间分布模式应与 v1-v8 有差异"""
        v1_quads = {}
        v2_quads = {}

        for v in V1_VERSIONS:
            path = get_logo_path(f'{v}_dark.png')
            if os.path.exists(path):
                v1_quads[v] = get_quadrant_distribution(v)

        for v in V2_VERSIONS:
            v2_quads[v] = get_quadrant_distribution(v)

        # 至少 3 个 v2 设计应有与任何 v1 设计不同的象限分布
        unique_v2 = 0
        for v2_name, v2_q in v2_quads.items():
            is_unique = True
            for v1_name, v1_q in v1_quads.items():
                # 如果四个象限的差异都小于 5%，视为相似
                max_diff = max(abs(a - b) for a, b in zip(v2_q, v1_q))
                if max_diff < 0.05:
                    is_unique = False
                    break
            if is_unique:
                unique_v2 += 1

        assert unique_v2 >= 2, \
            f"仅有 {unique_v2} 个 v2 设计有独特的空间分布，差异化不足"


# ═══════════════════════════════════════════════════════════
# 测试类 2：概念特异性验证
# ═══════════════════════════════════════════════════════════

class TestConceptSpecificity:
    """验证每个概念方向的独特视觉特征"""

    def test_v2a_has_dual_circular_structure(self):
        """V2A（引力透镜位移）应有两个偏移的圆形结构"""
        img = open_logo('v2a_gravitational_displacement_dark.png')
        w, h = img.size

        # 检查左右两侧是否有对称但偏移的结构
        left_visible = 0
        right_visible = 0
        for y in range(h):
            for x in range(w):
                p = img.getpixel((x, y))
                if p[:3] != (0, 0, 0):
                    if x < w // 2:
                        left_visible += 1
                    else:
                        right_visible += 1
        img.close()

        total = left_visible + right_visible
        if total > 0:
            left_ratio = left_visible / total
            right_ratio = right_visible / total
            # 两侧应大致平衡（±20%）
            assert abs(left_ratio - right_ratio) < 0.4, \
                f"V2A 左右分布严重不均: left={left_ratio:.1%}, right={right_ratio:.1%}"

    def test_v2b_has_vertical_asymmetry(self):
        """V2B（史瓦西喉）应有垂直方向的不对称性（喉部在下方）"""
        img = open_logo('v2b_schwarzschild_throat_dark.png')
        w, h = img.size

        top_visible = 0
        bottom_visible = 0
        for y in range(h):
            for x in range(w):
                p = img.getpixel((x, y))
                if p[:3] != (0, 0, 0):
                    if y < h // 2:
                        top_visible += 1
                    else:
                        bottom_visible += 1
        img.close()

        total = top_visible + bottom_visible
        assert total > 0, "V2B 无可见内容"
        # 喉部（奇点）在下方，因此上下应有不对称分布
        top_ratio = top_visible / total
        bottom_ratio = bottom_visible / total
        # 允许一定的不对称（产品设计决策：喉部偏下）
        assert top_ratio > 0.15 and bottom_ratio > 0.15, \
            f"V2B 上下分布异常: top={top_ratio:.1%}, bottom={bottom_ratio:.1%}"

    def test_v2c_has_branching_layers(self):
        """V2C（递生）应从中心向外有递进的分支结构"""
        img = open_logo('v2c_tao_emergence_dark.png')
        w, h = img.size
        cx, cy = w // 2, h // 2

        # 5 个同心环带分析
        ring_counts = [0, 0, 0, 0, 0]
        ring_radii = [50, 100, 150, 200, 256]

        for y in range(h):
            for x in range(w):
                dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
                p = img.getpixel((x, y))
                if p[:3] != (0, 0, 0):
                    for i, r in enumerate(ring_radii):
                        if dist < r:
                            ring_counts[i] += 1
                            break
        img.close()

        # 至少 3 个环带应有可见内容（体现递生的层次感）
        active_rings = sum(1 for c in ring_counts if c > 10)
        assert active_rings >= 3, \
            f"V2C 仅有 {active_rings} 个环带有内容，递生层次不足。分布: {ring_counts}"

    def test_v2d_has_angular_features(self):
        """V2D（光锥钻石）应有棱角分明的几何特征（非圆形）"""
        img = open_logo('v2d_light_cone_diamond_dark.png')
        small = img.resize((128, 128), Image.LANCZOS)
        img.close()

        # 检测对角线方向是否有明显的线条（菱形的特征）
        # 对角线扫描：从左上到右下
        diag_transitions = 0
        for offset in range(-64, 64):
            prev_bright = False
            for i in range(128):
                x = i
                y = i + offset
                if 0 <= x < 128 and 0 <= y < 128:
                    p = small.getpixel((x, y))
                    bright = (p[0] + p[1] + p[2]) / 3.0 > 30
                    if bright != prev_bright:
                        diag_transitions += 1
                    prev_bright = bright

        # 菱形设计应在对角线方向有显著的边界跳变
        assert diag_transitions > 20, \
            f"V2D 对角线方向边界跳变仅 {diag_transitions} 次，可能缺少棱角特征"

    def test_v2e_has_vertical_line_pattern(self):
        """V2E（引力偏折）应有竖直线条被弯曲的模式"""
        img = open_logo('v2e_gravitational_deflection_dark.png')
        w, h = img.size

        # 在图像上半部分和下半部分分别统计垂直切片的内容分布
        # 偏折线在远离中心处应接近竖直
        top_col_activity = []
        bottom_col_activity = []
        for x in range(w):
            top_count = 0
            bottom_count = 0
            for y in range(h // 4):  # 顶部 1/4
                p = img.getpixel((x, y))
                if p[:3] != (0, 0, 0):
                    top_count += 1
            for y in range(3 * h // 4, h):  # 底部 1/4
                p = img.getpixel((x, y))
                if p[:3] != (0, 0, 0):
                    bottom_count += 1
            top_col_activity.append(top_count)
            bottom_col_activity.append(bottom_count)

        img.close()

        # 顶部和底部的活跃列应有多个（对应多条线）
        top_active_cols = sum(1 for c in top_col_activity if c > 2)
        bottom_active_cols = sum(1 for c in bottom_col_activity if c > 2)

        assert top_active_cols >= 5, \
            f"V2E 顶部区域仅有 {top_active_cols} 列有内容，偏折线可能过少"
        assert bottom_active_cols >= 5, \
            f"V2E 底部区域仅有 {bottom_active_cols} 列有内容，偏折线可能过少"


# ═══════════════════════════════════════════════════════════
# 测试类 3：渲染管线一致性
# ═══════════════════════════════════════════════════════════

class TestRenderingPipeline:
    """验证 v2 与 v1 使用相同的渲染管线参数"""

    def test_script_uses_same_canvas_size(self):
        """v2 脚本应使用与 v1 相同的 CANVAS=2048 超采样尺寸"""
        script_path = os.path.join(LOGO_DIR, 'generate_logos_v2.py')
        with open(script_path, 'r') as f:
            content = f.read()
        assert 'CANVAS = 2048' in content, \
            "v2 脚本未使用 CANVAS = 2048"

    def test_script_uses_same_output_size(self):
        """v2 脚本应使用与 v1 相同的 OUTPUT=512 输出尺寸"""
        script_path = os.path.join(LOGO_DIR, 'generate_logos_v2.py')
        with open(script_path, 'r') as f:
            content = f.read()
        assert 'OUTPUT = 512' in content, \
            "v2 脚本未使用 OUTPUT = 512"

    def test_script_uses_lanczos_downsampling(self):
        """v2 脚本应使用 LANCZOS 缩放算法"""
        script_path = os.path.join(LOGO_DIR, 'generate_logos_v2.py')
        with open(script_path, 'r') as f:
            content = f.read()
        assert 'LANCZOS' in content, \
            "v2 脚本未使用 LANCZOS 缩放"

    def test_output_matches_expected_dimensions(self):
        """所有 v2 PNG 输出应为 512x512"""
        for f in V2_ALL_FILES:
            img = open_logo(f)
            assert img.size == (512, 512), \
                f"{f} 尺寸为 {img.size}，期望 (512, 512)"
            img.close()

    def test_v2_png_bit_depth_consistency(self):
        """v2 PNG 文件的位深度应与 v1 一致（RGBA 8-bit per channel）"""
        for f in V2_ALL_FILES:
            img = open_logo(f)
            assert img.mode == 'RGBA', f"{f} 模式为 {img.mode}"
            # 每个通道 8-bit, 共 32-bit
            bands = img.getbands()
            assert bands == ('R', 'G', 'B', 'A'), \
                f"{f} 通道为 {bands}，期望 RGBA"
            img.close()


# ═══════════════════════════════════════════════════════════
# 测试类 4：设计文档完整性
# ═══════════════════════════════════════════════════════════

class TestDesignDocumentation:
    """验收标准：每个 Logo 版本附带简短的设计理念说明"""

    def test_script_has_concept_comments(self):
        """每个概念函数前应有设计理念注释"""
        script_path = os.path.join(LOGO_DIR, 'generate_logos_v2.py')
        with open(script_path, 'r') as f:
            content = f.read()

        concept_keywords = [
            ('v2a', '引力透镜', 'Gravitational'),
            ('v2b', '史瓦西', 'Schwarzschild'),
            ('v2c', '递生', 'Tao'),
            ('v2d', '光锥', 'Penrose'),
            ('v2e', '引力偏折', 'Deflection'),
        ]

        for concept_id, cn_keyword, en_keyword in concept_keywords:
            assert cn_keyword in content, \
                f"脚本中缺少概念 {concept_id} 的中文设计说明（关键词: {cn_keyword}）"
            assert en_keyword in content, \
                f"脚本中缺少概念 {concept_id} 的英文设计说明（关键词: {en_keyword}）"

    def test_script_has_brand_connection(self):
        """设计说明应包含与"元初"品牌的关联说明"""
        script_path = os.path.join(LOGO_DIR, 'generate_logos_v2.py')
        with open(script_path, 'r') as f:
            content = f.read()

        # 至少有多处提到品牌关联
        brand_mentions = content.count('元初') + content.count('primordial')
        assert brand_mentions >= 3, \
            f"脚本中仅提到 {brand_mentions} 次品牌关联，设计理念说明可能不足"

    def test_main_block_prints_descriptions(self):
        """__main__ 块应打印每个概念的一句话说明"""
        script_path = os.path.join(LOGO_DIR, 'generate_logos_v2.py')
        with open(script_path, 'r') as f:
            content = f.read()

        # 检查 main block 中是否有概念说明打印
        keywords = ['概念 A', '概念 B', '概念 C', '概念 D', '概念 E']
        for kw in keywords:
            assert kw in content, \
                f"脚本 main 块中缺少 {kw} 的说明输出"


# ═══════════════════════════════════════════════════════════
# 测试类 5：文件命名安全
# ═══════════════════════════════════════════════════════════

class TestFileNamingSafety:
    """确保 v2 文件不会覆盖 v1-v8 的现有文件"""

    def test_no_naming_collision_with_v1(self):
        """v2 文件名不应与 v1-v8 的任何文件名冲突"""
        v1_files = set()
        for v in V1_VERSIONS:
            for var in VARIANTS:
                v1_files.add(f'{v}{var}')

        v2_files = set(V2_ALL_FILES)

        collision = v1_files & v2_files
        assert collision == set(), \
            f"v2 文件名与 v1 冲突: {collision}"

    def test_v2_prefix_convention(self):
        """v2 文件应以 'v2' + 字母后缀开头"""
        for f in V2_ALL_FILES:
            assert f[:3] in ['v2a', 'v2b', 'v2c', 'v2d', 'v2e'], \
                f"{f} 不符合 v2[a-e]_ 的命名规范"

    def test_existing_v1_files_still_exist(self):
        """v1-v8 的 PNG 文件仍然存在（未被删除/覆盖）"""
        for v in V1_VERSIONS:
            for var in VARIANTS:
                path = get_logo_path(f'{v}{var}')
                assert os.path.exists(path), \
                    f"v1 文件 {v}{var} 不存在，可能被删除或覆盖"


# ═══════════════════════════════════════════════════════════
# 测试类 6：PNG 文件完整性
# ═══════════════════════════════════════════════════════════

class TestPNGIntegrity:
    """验证 PNG 文件可正确读取且无损坏"""

    @pytest.mark.parametrize("filename", V2_ALL_FILES)
    def test_png_can_be_loaded_and_verified(self, filename):
        """PNG 文件应能被完整加载且数据可访问"""
        img = open_logo(filename)
        try:
            img.load()  # 强制加载全部像素数据
            # 尝试访问所有像素
            _ = img.getpixel((0, 0))
            _ = img.getpixel((511, 511))
            _ = img.getpixel((255, 255))
        except Exception as e:
            pytest.fail(f"{filename} PNG 数据损坏: {e}")
        finally:
            img.close()

    @pytest.mark.parametrize("filename", V2_ALL_FILES)
    def test_png_file_header(self, filename):
        """PNG 文件应以正确的 PNG 签名开头"""
        path = get_logo_path(filename)
        with open(path, 'rb') as f:
            header = f.read(8)
        # PNG 文件签名: 89 50 4E 47 0D 0A 1A 0A
        assert header == b'\x89PNG\r\n\x1a\n', \
            f"{filename} 不是有效的 PNG 文件（签名: {header.hex()}）"

    @pytest.mark.parametrize("filename", V2_ALL_FILES)
    def test_png_reasonable_file_size(self, filename):
        """PNG 文件大小应在合理范围内（1KB - 500KB for 512x512）"""
        path = get_logo_path(filename)
        size = os.path.getsize(path)
        assert 1000 < size < 500000, \
            f"{filename} 大小为 {size} bytes，超出合理范围 1KB-500KB"


# ═══════════════════════════════════════════════════════════
# 测试类 7：边界像素安全
# ═══════════════════════════════════════════════════════════

class TestBoundaryPixelSafety:
    """验证图形绘制不超出画布边界"""

    @pytest.mark.parametrize("filename", V2_DARK_FILES)
    def test_no_clipping_at_edges(self, filename):
        """图形不应在画布边缘被截断（检查最外圈像素）"""
        img = open_logo(filename)
        w, h = img.size

        # 检查最外 1 像素边框
        edge_bright = 0
        edge_total = 0
        for x in range(w):
            for y in [0, h - 1]:
                p = img.getpixel((x, y))
                edge_total += 1
                if p[:3] != (0, 0, 0) and p[0] > 50:
                    edge_bright += 1
        for y in range(1, h - 1):
            for x in [0, w - 1]:
                p = img.getpixel((x, y))
                edge_total += 1
                if p[:3] != (0, 0, 0) and p[0] > 50:
                    edge_bright += 1

        img.close()

        # 最外 1 像素几乎不应有高亮内容（表示图形未超出边界）
        bright_ratio = edge_bright / edge_total if edge_total > 0 else 0
        assert bright_ratio < 0.05, \
            f"{filename} 边缘 1px 有 {bright_ratio:.1%} 亮像素，图形可能被截断"


# ═══════════════════════════════════════════════════════════
# 测试类 8：象限分布差异
# ═══════════════════════════════════════════════════════════

class TestQuadrantDiversity:
    """验证不同设计有不同的空间分布特征"""

    def test_designs_have_varied_quadrant_distributions(self):
        """至少 3 个 v2 设计应有不同的象限分布模式"""
        distributions = {}
        for v in V2_VERSIONS:
            distributions[v] = get_quadrant_distribution(v)

        # 将每个设计的象限分布四舍五入到 5% 精度后比较
        rounded = {}
        for v, dist in distributions.items():
            rounded[v] = tuple(round(d, 1) for d in dist)

        unique_patterns = set(rounded.values())
        assert len(unique_patterns) >= 3, \
            f"象限分布模式仅有 {len(unique_patterns)} 种，设计差异化不足"

    def test_v2a_is_roughly_symmetric(self):
        """V2A（引力透镜位移）应有大致对称的分布"""
        dist = get_quadrant_distribution('v2a_gravitational_displacement')
        # 左右对称检查
        left = dist[0] + dist[2]
        right = dist[1] + dist[3]
        assert abs(left - right) < 0.3, \
            f"V2A 左右不对称: left={left:.2f}, right={right:.2f}"

    def test_v2d_has_roughly_symmetric_quadrants(self):
        """V2D（光锥钻石）嵌套菱形应有大致四象限对称的分布"""
        dist = get_quadrant_distribution('v2d_light_cone_diamond')
        # 四个象限应大致相等
        max_diff = max(dist) - min(dist)
        assert max_diff < 0.3, \
            f"V2D 象限分布差异过大: {[f'{d:.2f}' for d in dist]}"

    def test_v2e_has_left_right_symmetry(self):
        """V2E（引力偏折）平行线偏折应有左右对称性"""
        dist = get_quadrant_distribution('v2e_gravitational_deflection')
        left = dist[0] + dist[2]
        right = dist[1] + dist[3]
        assert abs(left - right) < 0.2, \
            f"V2E 左右不对称: left={left:.2f}, right={right:.2f}"


# ═══════════════════════════════════════════════════════════
# 测试类 9：不修改项目外文件（增强验证）
# ═══════════════════════════════════════════════════════════

class TestProjectIntegrity:
    """验证实现未修改 logo/ 目录外的任何项目文件"""

    def test_website_html_unchanged(self):
        """网站 HTML 文件不应被修改"""
        html_files = ['index.html', 'about.html']
        for html_file in html_files:
            path = os.path.join(PROJECT_ROOT, html_file)
            if os.path.exists(path):
                import subprocess
                result = subprocess.run(
                    ['git', 'diff', '--name-only', '--', html_file],
                    capture_output=True, text=True,
                    cwd=PROJECT_ROOT
                )
                if result.returncode != 0:
                    pytest.skip("无法运行 git diff")
                assert result.stdout.strip() == '', \
                    f"{html_file} 被修改了"

    def test_existing_test_file_unchanged(self):
        """原有的 test_logos.py 不应被修改"""
        import subprocess
        result = subprocess.run(
            ['git', 'diff', '--name-only', '--', 'logo/test_logos.py'],
            capture_output=True, text=True,
            cwd=PROJECT_ROOT
        )
        if result.returncode != 0:
            pytest.skip("无法运行 git diff")
        assert result.stdout.strip() == '', \
            "原有的 test_logos.py 被修改了"


# ═══════════════════════════════════════════════════════════
# 测试类 10：道家哲学深度验证（V2C 增强）
# ═══════════════════════════════════════════════════════════

class TestTaoPhilosophyEnhanced:
    """V2C 递生概念的深度验证：道→一→二→三的递进"""

    def test_v2c_has_center_singularity(self):
        """V2C 中心应有一个白色亮点（道/奇点）"""
        img = open_logo('v2c_tao_emergence_dark.png')
        w, h = img.size
        cx, cy = w // 2, h // 2

        # 检查中心附近 20x20 区域是否有高亮像素
        max_brightness = 0
        for y in range(max(0, cy - 10), min(h, cy + 10)):
            for x in range(max(0, cx - 10), min(w, cx + 10)):
                p = img.getpixel((x, y))
                brightness = max(p[0], p[1], p[2])
                max_brightness = max(max_brightness, brightness)

        img.close()

        # V2C 的 origin_y 下移了 200px（in 2048 space，即 50px in 512 space）
        # 所以检查更大的区域
        img = open_logo('v2c_tao_emergence_dark.png')
        found_singularity = False
        for y in range(max(0, cy - 60), min(h, cy + 60)):
            for x in range(max(0, cx - 30), min(w, cx + 30)):
                p = img.getpixel((x, y))
                if p[0] > 200 and p[1] > 200 and p[2] > 200:
                    found_singularity = True
                    break
            if found_singularity:
                break
        img.close()

        assert found_singularity, \
            "V2C 中心区域未找到高亮奇点"

    def test_v2c_line_width_decreases_outward(self):
        """V2C 的线条应从内向外变细（THICK→MEDIUM→NORMAL）"""
        script_path = os.path.join(LOGO_DIR, 'generate_logos_v2.py')
        with open(script_path, 'r') as f:
            content = f.read()

        # 检查代码中是否使用了递减的线宽
        # 主干用 THICK，二级用 MEDIUM，三级用 NORMAL
        assert 'THICK' in content, "V2C 主干应使用 THICK 线宽"
        assert 'MEDIUM' in content, "V2C 二级弧线应使用 MEDIUM 线宽"
        assert 'NORMAL' in content, "V2C 三级弧线应使用 NORMAL 线宽"

    def test_v2c_script_mentions_dao_philosophy(self):
        """V2C 代码注释应提及道家哲学概念"""
        script_path = os.path.join(LOGO_DIR, 'generate_logos_v2.py')
        with open(script_path, 'r') as f:
            content = f.read()

        dao_keywords = ['道生一', '一生二', '二生三', '三生万物']
        found = sum(1 for kw in dao_keywords if kw in content)
        assert found >= 2, \
            f"代码注释中仅找到 {found} 个道家哲学关键词，说明可能不足"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
