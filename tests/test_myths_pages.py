#!/usr/bin/env python3
"""
元初AI (yuanchu.ai) - 神话故事模块测试套件
============================================
测试对象：myths/ 目录下的所有故事页面
测试范围：
  1. HTML 结构完整性（DOCTYPE、head、body、必要元素）
  2. 故事首页 Timeline 内容和链接
  3. 5个故事页面的导航链完整性
  4. 内容丰富度（段落数、古籍引文、AI映射数量）
  5. 视觉标识（渐变色、背景色一致性）
  6. 移动端适配（响应式媒体查询）
  7. 容错机制（图片 onerror）
  8. Canvas 粒子动画脚本
  9. tracker.js 引用
"""

import unittest
import os
import re
from html.parser import HTMLParser


# ============================================================================
# HTML 解析工具
# ============================================================================

class HTMLStructureParser(HTMLParser):
    """解析 HTML 结构，提取关键元素信息"""

    def __init__(self):
        super().__init__()
        self.tags_stack = []
        self.all_tags = []
        self.links = []  # (href, text)
        self.images = []  # (src, alt, has_onerror)
        self.meta_tags = []  # (name/charset, content)
        self.title = ""
        self.current_tag = None
        self.current_attrs = {}
        self.in_title = False
        self.in_h1 = False
        self.in_h2 = False
        self.in_h3 = False
        self.in_p = False
        self.in_footer = False
        self.in_nav = False
        self.in_section = False
        self.current_section_id = None
        self.h1_text = ""
        self.h2_texts = []
        self.h3_texts = []
        self.p_texts = []
        self.p_classes = []  # (class, text)
        self.sections = {}  # id -> content info
        self.footer_links = []
        self.nav_links = []
        self.has_canvas = False
        self.has_doctype = False
        self.html_lang = ""
        self.scripts = []  # script src or inline content snippet
        self.style_content = ""
        self.in_style = False
        self.section_depth = 0
        self.div_classes = []
        self.ai_items_count = 0
        self.current_text = ""
        self.timeline_items = []  # Timeline items info
        self.in_timeline_item = False
        self.timeline_item_links = []
        self.current_p_class = ""

    def handle_decl(self, decl):
        if decl.lower().startswith('doctype'):
            self.has_doctype = True

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        self.all_tags.append(tag)

        if tag == 'html':
            self.html_lang = attrs_dict.get('lang', '')
        elif tag == 'meta':
            charset = attrs_dict.get('charset', '')
            name = attrs_dict.get('name', '')
            content = attrs_dict.get('content', '')
            self.meta_tags.append({'charset': charset, 'name': name, 'content': content})
        elif tag == 'title':
            self.in_title = True
        elif tag == 'canvas':
            self.has_canvas = True
        elif tag == 'h1':
            self.in_h1 = True
            self.current_text = ""
        elif tag == 'h2':
            self.in_h2 = True
            self.current_text = ""
        elif tag == 'h3':
            self.in_h3 = True
            self.current_text = ""
        elif tag == 'p':
            self.in_p = True
            self.current_text = ""
            self.current_p_class = attrs_dict.get('class', '')
        elif tag == 'a':
            href = attrs_dict.get('href', '')
            self.current_tag = 'a'
            self.current_attrs = {'href': href}
            self.current_text = ""
            if self.in_footer:
                self.footer_links.append({'href': href, 'text': ''})
            if self.in_nav:
                self.nav_links.append({'href': href, 'text': ''})
        elif tag == 'img':
            src = attrs_dict.get('src', '')
            alt = attrs_dict.get('alt', '')
            has_onerror = 'onerror' in attrs_dict
            self.images.append({'src': src, 'alt': alt, 'has_onerror': has_onerror})
        elif tag == 'section':
            self.in_section = True
            self.current_section_id = attrs_dict.get('id', '')
            self.section_depth += 1
        elif tag == 'footer':
            self.in_footer = True
        elif tag == 'nav':
            self.in_nav = True
        elif tag == 'style':
            self.in_style = True
            self.current_text = ""
        elif tag == 'script':
            src = attrs_dict.get('src', '')
            if src:
                self.scripts.append({'type': 'external', 'src': src})
            else:
                self.scripts.append({'type': 'inline', 'content': ''})
            self.current_tag = 'script'
            self.current_text = ""
        elif tag == 'div':
            cls = attrs_dict.get('class', '')
            self.div_classes.append(cls)
            if 'timeline-item' in cls:
                self.in_timeline_item = True
            if 'ai-item' in cls:
                self.ai_items_count += 1

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        elif tag == 'h1':
            self.in_h1 = False
            self.h1_text = self.current_text.strip()
        elif tag == 'h2':
            self.in_h2 = False
            self.h2_texts.append(self.current_text.strip())
        elif tag == 'h3':
            self.in_h3 = False
            self.h3_texts.append(self.current_text.strip())
        elif tag == 'p':
            self.in_p = False
            text = self.current_text.strip()
            self.p_texts.append(text)
            self.p_classes.append({'class': self.current_p_class, 'text': text})
        elif tag == 'a':
            if self.current_tag == 'a':
                text = self.current_text.strip()
                href = self.current_attrs.get('href', '')
                self.links.append({'href': href, 'text': text})
                if self.in_footer and self.footer_links:
                    self.footer_links[-1]['text'] = text
                if self.in_nav and self.nav_links:
                    self.nav_links[-1]['text'] = text
                if self.in_timeline_item:
                    self.timeline_item_links.append({'href': href, 'text': text})
            self.current_tag = None
        elif tag == 'section':
            self.section_depth -= 1
            if self.section_depth <= 0:
                self.in_section = False
                self.current_section_id = None
        elif tag == 'footer':
            self.in_footer = False
        elif tag == 'nav':
            self.in_nav = False
        elif tag == 'style':
            self.in_style = False
            self.style_content = self.current_text
        elif tag == 'script':
            if self.current_tag == 'script':
                content = self.current_text.strip()
                # Update last inline script with content
                for s in reversed(self.scripts):
                    if s['type'] == 'inline' and not s['content']:
                        s['content'] = content[:200]  # First 200 chars
                        break
            self.current_tag = None
        elif tag == 'div':
            if self.in_timeline_item:
                self.in_timeline_item = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_h1 or self.in_h2 or self.in_h3 or self.in_p:
            self.current_text += data
        if self.current_tag == 'a':
            self.current_text += data
        if self.in_style:
            self.current_text += data
        if self.current_tag == 'script':
            self.current_text += data


def parse_html(filepath):
    """解析 HTML 文件并返回结构信息"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    parser = HTMLStructureParser()
    # Check for DOCTYPE before parsing (HTMLParser doesn't always catch it)
    if content.strip().lower().startswith('<!doctype'):
        parser.has_doctype = True
    parser.feed(content)
    parser.raw_content = content
    return parser


# ============================================================================
# 测试基类
# ============================================================================

BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'myths')

STORY_PAGES = {
    'pangu': os.path.join(BASE_DIR, 'pangu.html'),
    'nvwa': os.path.join(BASE_DIR, 'nvwa.html'),
    'youchao': os.path.join(BASE_DIR, 'youchao.html'),
    'suiren': os.path.join(BASE_DIR, 'suiren.html'),
    'fuxi': os.path.join(BASE_DIR, 'fuxi.html'),
}

INDEX_PAGE = os.path.join(BASE_DIR, 'index.html')


# ============================================================================
# 测试1：文件存在性检查
# ============================================================================

class TestFileExistence(unittest.TestCase):
    """测试所有必要文件是否存在"""

    def test_index_page_exists(self):
        """故事首页 index.html 应该存在"""
        self.assertTrue(os.path.exists(INDEX_PAGE),
                        f"故事首页不存在: {INDEX_PAGE}")

    def test_pangu_page_exists(self):
        """盘古开天地页面应该存在"""
        self.assertTrue(os.path.exists(STORY_PAGES['pangu']),
                        "pangu.html 不存在")

    def test_nvwa_page_exists(self):
        """女娲造人页面应该存在"""
        self.assertTrue(os.path.exists(STORY_PAGES['nvwa']),
                        "nvwa.html 不存在")

    def test_youchao_page_exists(self):
        """有巢构木页面应该存在（新建）"""
        self.assertTrue(os.path.exists(STORY_PAGES['youchao']),
                        "youchao.html 不存在")

    def test_suiren_page_exists(self):
        """燧人取火页面应该存在（新建）"""
        self.assertTrue(os.path.exists(STORY_PAGES['suiren']),
                        "suiren.html 不存在")

    def test_fuxi_page_exists(self):
        """伏羲画卦页面应该存在（新建）"""
        self.assertTrue(os.path.exists(STORY_PAGES['fuxi']),
                        "fuxi.html 不存在")


# ============================================================================
# 测试2：HTML 基础结构
# ============================================================================

class TestHTMLStructure(unittest.TestCase):
    """测试所有页面的 HTML 基础结构"""

    @classmethod
    def setUpClass(cls):
        cls.parsers = {}
        for name, path in STORY_PAGES.items():
            if os.path.exists(path):
                cls.parsers[name] = parse_html(path)
        if os.path.exists(INDEX_PAGE):
            cls.parsers['index'] = parse_html(INDEX_PAGE)

    def test_all_pages_have_doctype(self):
        """所有页面应包含 DOCTYPE 声明"""
        for name, parser in self.parsers.items():
            with self.subTest(page=name):
                self.assertTrue(parser.has_doctype,
                                f"{name} 缺少 DOCTYPE 声明")

    def test_all_pages_have_zh_cn_lang(self):
        """所有页面应设置 lang="zh-CN" """
        for name, parser in self.parsers.items():
            with self.subTest(page=name):
                self.assertEqual(parser.html_lang, 'zh-CN',
                                 f"{name} 的 lang 属性不是 zh-CN，当前值: {parser.html_lang}")

    def test_all_pages_have_utf8_charset(self):
        """所有页面应设置 UTF-8 编码"""
        for name, parser in self.parsers.items():
            with self.subTest(page=name):
                has_utf8 = any(m['charset'].upper() == 'UTF-8' for m in parser.meta_tags)
                self.assertTrue(has_utf8,
                                f"{name} 缺少 UTF-8 charset 声明")

    def test_all_pages_have_viewport_meta(self):
        """所有页面应设置 viewport meta（移动端适配）"""
        for name, parser in self.parsers.items():
            with self.subTest(page=name):
                has_viewport = any(m['name'] == 'viewport' for m in parser.meta_tags)
                self.assertTrue(has_viewport,
                                f"{name} 缺少 viewport meta 标签")

    def test_all_pages_have_title(self):
        """所有页面应有非空 title"""
        for name, parser in self.parsers.items():
            with self.subTest(page=name):
                self.assertTrue(len(parser.title.strip()) > 0,
                                f"{name} 的 title 为空")

    def test_story_pages_title_format(self):
        """故事页面的 title 应包含故事名和"元初"标识"""
        expected_titles = {
            'pangu': '盘古开天地',
            'nvwa': '女娲造人',
            'youchao': '有巢构木',
            'suiren': '燧人取火',
            'fuxi': '伏羲画卦',
        }
        for name, expected in expected_titles.items():
            if name in self.parsers:
                with self.subTest(page=name):
                    title = self.parsers[name].title
                    self.assertIn(expected, title,
                                  f"{name} 的 title '{title}' 中未包含 '{expected}'")
                    self.assertIn('元初', title,
                                  f"{name} 的 title '{title}' 中未包含 '元初'")


# ============================================================================
# 测试3：故事首页 Timeline
# ============================================================================

class TestIndexTimeline(unittest.TestCase):
    """测试故事首页的 Timeline 内容"""

    @classmethod
    def setUpClass(cls):
        if os.path.exists(INDEX_PAGE):
            cls.parser = parse_html(INDEX_PAGE)
            cls.raw = cls.parser.raw_content
        else:
            cls.parser = None
            cls.raw = ""

    def test_timeline_has_5_items(self):
        """Timeline 应该恰好有 5 个故事项"""
        count = self.raw.count('timeline-item')
        # 减去 CSS 中的引用（class定义等），只计算 HTML 中的 div
        html_body = self.raw.split('<body')[1] if '<body' in self.raw else self.raw
        div_count = html_body.count('class="timeline-item"')
        self.assertEqual(div_count, 5,
                         f"Timeline 应有 5 个故事项，实际有 {div_count} 个")

    def test_timeline_story_order(self):
        """Timeline 故事顺序应为：盘古→女娲→有巢→燧人→伏羲"""
        expected_order = ['盘古开天地', '女娲造人', '有巢构木', '燧人取火', '伏羲画卦']
        h3_in_timeline = re.findall(r'<h3>(.*?)</h3>', self.raw)
        self.assertEqual(len(h3_in_timeline), 5,
                         f"Timeline 中应有 5 个 h3 标题，实际有 {len(h3_in_timeline)} 个")
        for i, expected in enumerate(expected_order):
            self.assertEqual(h3_in_timeline[i], expected,
                             f"第 {i+1} 个故事应为 '{expected}'，实际为 '{h3_in_timeline[i]}'")

    def test_timeline_links_correct(self):
        """Timeline 中每个故事的链接应指向正确的页面"""
        expected_links = {
            '盘古开天地': 'pangu.html',
            '女娲造人': 'nvwa.html',
            '有巢构木': 'youchao.html',
            '燧人取火': 'suiren.html',
            '伏羲画卦': 'fuxi.html',
        }
        for story, expected_href in expected_links.items():
            with self.subTest(story=story):
                # 查找包含故事名的链接
                pattern = rf'href="({re.escape(expected_href)})"[^>]*>.*?{re.escape(story)}'
                match = re.search(pattern, self.raw, re.DOTALL)
                self.assertIsNotNone(match,
                                     f"'{story}' 的链接应指向 '{expected_href}'")

    def test_timeline_has_descriptions(self):
        """每个 Timeline 项应包含描述文案"""
        timeline_items = re.findall(
            r'<div class="timeline-item">(.*?)</div>\s*(?:<div class="timeline-item">|</div>)',
            self.raw, re.DOTALL
        )
        # 简单检查：每个 timeline-content 内应有 <p> 描述
        p_tags = re.findall(r'class="timeline-content".*?<p>(.*?)</p>', self.raw, re.DOTALL)
        self.assertGreaterEqual(len(p_tags), 5,
                                f"Timeline 中每项都应有描述，找到 {len(p_tags)} 个 <p>")

    def test_timeline_has_meta_labels(self):
        """每个 Timeline 项应有 meta 标签（英文名+主题）"""
        expected_metas = ['Pangu', 'Nvwa', 'Youchao', 'Suiren', 'Fuxi']
        for meta in expected_metas:
            with self.subTest(meta=meta):
                self.assertIn(meta, self.raw,
                              f"Timeline 中未找到 meta '{meta}'")

    def test_timeline_has_year_labels(self):
        """每个 Timeline 项应有 timeline-year 标签"""
        year_count = self.raw.count('class="timeline-year"')
        self.assertEqual(year_count, 5,
                         f"应有 5 个 timeline-year 标签，实际有 {year_count} 个")


# ============================================================================
# 测试4：导航链完整性
# ============================================================================

class TestNavigationChain(unittest.TestCase):
    """测试5个故事页面的前后导航链"""

    @classmethod
    def setUpClass(cls):
        cls.raws = {}
        for name, path in STORY_PAGES.items():
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    cls.raws[name] = f.read()

    def _get_footer_content(self, raw):
        """提取 footer 区域内容"""
        match = re.search(r'<footer>(.*?)</footer>', raw, re.DOTALL)
        return match.group(1) if match else ""

    def test_pangu_nav_no_previous(self):
        """盘古页面不应有"上一个"链接"""
        footer = self._get_footer_content(self.raws.get('pangu', ''))
        self.assertNotIn('上一个', footer,
                         "盘古页面不应有上一个故事链接")

    def test_pangu_nav_next_is_nvwa(self):
        """盘古页面的"下一个"应指向女娲造人"""
        footer = self._get_footer_content(self.raws.get('pangu', ''))
        self.assertIn('nvwa.html', footer,
                      "盘古页面的下一个应链接到 nvwa.html")
        self.assertIn('女娲造人', footer,
                      "盘古页面的下一个应显示'女娲造人'")

    def test_nvwa_nav_previous_is_pangu(self):
        """女娲页面的"上一个"应指向盘古开天地"""
        footer = self._get_footer_content(self.raws.get('nvwa', ''))
        self.assertIn('pangu.html', footer,
                      "女娲页面的上一个应链接到 pangu.html")
        self.assertIn('盘古开天地', footer,
                      "女娲页面的上一个应显示'盘古开天地'")

    def test_nvwa_nav_next_is_youchao(self):
        """女娲页面的"下一个"应指向有巢构木"""
        footer = self._get_footer_content(self.raws.get('nvwa', ''))
        self.assertIn('youchao.html', footer,
                      "女娲页面的下一个应链接到 youchao.html")
        self.assertIn('有巢构木', footer,
                      "女娲页面的下一个应显示'有巢构木'")

    def test_youchao_nav_previous_is_nvwa(self):
        """有巢页面的"上一个"应指向女娲造人"""
        footer = self._get_footer_content(self.raws.get('youchao', ''))
        self.assertIn('nvwa.html', footer,
                      "有巢页面的上一个应链接到 nvwa.html")
        self.assertIn('女娲造人', footer,
                      "有巢页面的上一个应显示'女娲造人'")

    def test_youchao_nav_next_is_suiren(self):
        """有巢页面的"下一个"应指向燧人取火"""
        footer = self._get_footer_content(self.raws.get('youchao', ''))
        self.assertIn('suiren.html', footer,
                      "有巢页面的下一个应链接到 suiren.html")
        self.assertIn('燧人取火', footer,
                      "有巢页面的下一个应显示'燧人取火'")

    def test_suiren_nav_previous_is_youchao(self):
        """燧人页面的"上一个"应指向有巢构木"""
        footer = self._get_footer_content(self.raws.get('suiren', ''))
        self.assertIn('youchao.html', footer,
                      "燧人页面的上一个应链接到 youchao.html")
        self.assertIn('有巢构木', footer,
                      "燧人页面的上一个应显示'有巢构木'")

    def test_suiren_nav_next_is_fuxi(self):
        """燧人页面的"下一个"应指向伏羲画卦"""
        footer = self._get_footer_content(self.raws.get('suiren', ''))
        self.assertIn('fuxi.html', footer,
                      "燧人页面的下一个应链接到 fuxi.html")
        self.assertIn('伏羲画卦', footer,
                      "燧人页面的下一个应显示'伏羲画卦'")

    def test_fuxi_nav_previous_is_suiren(self):
        """伏羲页面的"上一个"应指向燧人取火"""
        footer = self._get_footer_content(self.raws.get('fuxi', ''))
        self.assertIn('suiren.html', footer,
                      "伏羲页面的上一个应链接到 suiren.html")
        self.assertIn('燧人取火', footer,
                      "伏羲页面的上一个应显示'燧人取火'")

    def test_fuxi_nav_no_next(self):
        """伏羲页面不应有"下一个"链接"""
        footer = self._get_footer_content(self.raws.get('fuxi', ''))
        self.assertNotIn('下一个', footer,
                         "伏羲页面不应有下一个故事链接")

    def test_all_pages_have_home_link(self):
        """所有故事页面都应有"回到首页"链接"""
        for name in STORY_PAGES:
            with self.subTest(page=name):
                footer = self._get_footer_content(self.raws.get(name, ''))
                self.assertIn('回到首页', footer,
                              f"{name} 页面缺少'回到首页'链接")
                self.assertIn('yuanchu.ai/myths', footer,
                              f"{name} 页面的回到首页链接应指向 yuanchu.ai/myths")


# ============================================================================
# 测试5：内容丰富度
# ============================================================================

class TestContentRichness(unittest.TestCase):
    """测试每个故事页面的内容丰富度"""

    @classmethod
    def setUpClass(cls):
        cls.raws = {}
        for name, path in STORY_PAGES.items():
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    cls.raws[name] = f.read()

    def _count_text_paragraphs(self, raw):
        """统计 .text 类的段落数"""
        return len(re.findall(r'<p class="text">', raw))

    def _count_ancient_quotes(self, raw):
        """统计 .ancient 类的古籍引文数"""
        return len(re.findall(r'<p class="ancient">', raw))

    def _count_ai_items(self, raw):
        """统计 AI Metaphor 项数"""
        return len(re.findall(r'class="ai-item"', raw))

    def _has_quote_section(self, raw):
        """检查是否有 quote 区域"""
        return 'class="quote"' in raw

    # --- 盘古开天地 ---
    def test_pangu_text_paragraphs(self):
        """盘古页面应有至少8段 .text 叙述"""
        count = self._count_text_paragraphs(self.raws.get('pangu', ''))
        self.assertGreaterEqual(count, 8,
                                f"盘古页面 .text 段落数为 {count}，要求至少8段")

    def test_pangu_ancient_quotes(self):
        """盘古页面应有至少2段古籍引文"""
        count = self._count_ancient_quotes(self.raws.get('pangu', ''))
        self.assertGreaterEqual(count, 2,
                                f"盘古页面古籍引文数为 {count}，要求至少2段")

    def test_pangu_ai_items(self):
        """盘古页面应有至少6个 AI Metaphor 项"""
        count = self._count_ai_items(self.raws.get('pangu', ''))
        self.assertGreaterEqual(count, 6,
                                f"盘古页面 AI Metaphor 数为 {count}，要求至少6个")

    # --- 女娲造人 ---
    def test_nvwa_text_paragraphs(self):
        """女娲页面应有至少10段 .text 叙述"""
        count = self._count_text_paragraphs(self.raws.get('nvwa', ''))
        self.assertGreaterEqual(count, 10,
                                f"女娲页面 .text 段落数为 {count}，要求至少10段")

    def test_nvwa_ancient_quotes(self):
        """女娲页面应有至少2段古籍引文"""
        count = self._count_ancient_quotes(self.raws.get('nvwa', ''))
        self.assertGreaterEqual(count, 2,
                                f"女娲页面古籍引文数为 {count}，要求至少2段")

    def test_nvwa_ai_items(self):
        """女娲页面应有至少6个 AI Metaphor 项"""
        count = self._count_ai_items(self.raws.get('nvwa', ''))
        self.assertGreaterEqual(count, 6,
                                f"女娲页面 AI Metaphor 数为 {count}，要求至少6个")

    # --- 有巢构木 ---
    def test_youchao_text_paragraphs(self):
        """有巢页面应有至少6段 .text 叙述"""
        count = self._count_text_paragraphs(self.raws.get('youchao', ''))
        self.assertGreaterEqual(count, 6,
                                f"有巢页面 .text 段落数为 {count}，要求至少6段")

    def test_youchao_ancient_quotes(self):
        """有巢页面应有古籍引文（《韩非子·五蠹》）"""
        raw = self.raws.get('youchao', '')
        count = self._count_ancient_quotes(raw)
        self.assertGreaterEqual(count, 1,
                                f"有巢页面古籍引文数为 {count}，要求至少1段")
        self.assertIn('韩非子', raw,
                      "有巢页面应引用《韩非子》")

    def test_youchao_ai_items(self):
        """有巢页面应有至少5个 AI Metaphor 项"""
        count = self._count_ai_items(self.raws.get('youchao', ''))
        self.assertGreaterEqual(count, 5,
                                f"有巢页面 AI Metaphor 数为 {count}，要求至少5个")

    # --- 燧人取火 ---
    def test_suiren_text_paragraphs(self):
        """燧人页面应有至少6段 .text 叙述"""
        count = self._count_text_paragraphs(self.raws.get('suiren', ''))
        self.assertGreaterEqual(count, 6,
                                f"燧人页面 .text 段落数为 {count}，要求至少6段")

    def test_suiren_ancient_quotes(self):
        """燧人页面应有古籍引文（《韩非子·五蠹》或《太平御览》）"""
        raw = self.raws.get('suiren', '')
        count = self._count_ancient_quotes(raw)
        self.assertGreaterEqual(count, 1,
                                f"燧人页面古籍引文数为 {count}，要求至少1段")
        has_hanfeizi = '韩非子' in raw
        has_taiping = '太平御览' in raw
        self.assertTrue(has_hanfeizi or has_taiping,
                        "燧人页面应引用《韩非子》或《太平御览》")

    def test_suiren_ai_items(self):
        """燧人页面应有至少5个 AI Metaphor 项"""
        count = self._count_ai_items(self.raws.get('suiren', ''))
        self.assertGreaterEqual(count, 5,
                                f"燧人页面 AI Metaphor 数为 {count}，要求至少5个")

    # --- 伏羲画卦 ---
    def test_fuxi_text_paragraphs(self):
        """伏羲页面应有至少6段 .text 叙述"""
        count = self._count_text_paragraphs(self.raws.get('fuxi', ''))
        self.assertGreaterEqual(count, 6,
                                f"伏羲页面 .text 段落数为 {count}，要求至少6段")

    def test_fuxi_ancient_quotes(self):
        """伏羲页面应有古籍引文（《周易·系辞下》）"""
        raw = self.raws.get('fuxi', '')
        count = self._count_ancient_quotes(raw)
        self.assertGreaterEqual(count, 1,
                                f"伏羲页面古籍引文数为 {count}，要求至少1段")
        self.assertIn('系辞', raw,
                      "伏羲页面应引用《周易·系辞》")

    def test_fuxi_ai_items(self):
        """伏羲页面应有至少5个 AI Metaphor 项"""
        count = self._count_ai_items(self.raws.get('fuxi', ''))
        self.assertGreaterEqual(count, 5,
                                f"伏羲页面 AI Metaphor 数为 {count}，要求至少5个")

    # --- 通用检查 ---
    def test_all_pages_have_quote_section(self):
        """所有故事页面都应有 quote 引言区域"""
        for name in STORY_PAGES:
            with self.subTest(page=name):
                self.assertTrue(self._has_quote_section(self.raws.get(name, '')),
                                f"{name} 页面缺少 quote 引言区域")

    def test_all_pages_have_story_section(self):
        """所有故事页面都应有 id="story" 的 section"""
        for name in STORY_PAGES:
            with self.subTest(page=name):
                self.assertIn('id="story"', self.raws.get(name, ''),
                              f"{name} 页面缺少 story section")

    def test_all_pages_have_ai_section(self):
        """所有故事页面都应有 id="ai" 的 section"""
        for name in STORY_PAGES:
            with self.subTest(page=name):
                self.assertIn('id="ai"', self.raws.get(name, ''),
                              f"{name} 页面缺少 ai section")


# ============================================================================
# 测试6：视觉标识
# ============================================================================

class TestVisualIdentity(unittest.TestCase):
    """测试每个故事页面的独特视觉标识"""

    @classmethod
    def setUpClass(cls):
        cls.raws = {}
        for name, path in STORY_PAGES.items():
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    cls.raws[name] = f.read()

    def _extract_title_gradient(self, raw):
        """提取 .title-cn 的 background gradient"""
        # 匹配 .title-cn 样式块中的 linear-gradient
        match = re.search(r'\.title-cn\s*\{[^}]*background:\s*linear-gradient\(([^)]+)\)', raw)
        if match:
            return match.group(1)
        return None

    def _extract_body_background(self, raw):
        """提取 body 的 background 颜色"""
        match = re.search(r'body\s*\{[^}]*background:\s*(#[0-9a-fA-F]+)', raw)
        if match:
            return match.group(1)
        return None

    def test_pangu_has_gradient_title(self):
        """盘古页面应有白银色渐变标题"""
        gradient = self._extract_title_gradient(self.raws.get('pangu', ''))
        self.assertIsNotNone(gradient,
                             "盘古页面缺少标题渐变色")
        self.assertIn('#e0e0e0', gradient.lower(),
                      f"盘古渐变应包含 #e0e0e0，实际: {gradient}")

    def test_nvwa_has_gradient_title(self):
        """女娲页面应有粉色渐变标题"""
        gradient = self._extract_title_gradient(self.raws.get('nvwa', ''))
        self.assertIsNotNone(gradient,
                             "女娲页面缺少标题渐变色")
        self.assertIn('#ff9a9e', gradient.lower(),
                      f"女娲渐变应包含 #ff9a9e，实际: {gradient}")

    def test_youchao_has_gradient_title(self):
        """有巢页面应有绿色系渐变标题"""
        gradient = self._extract_title_gradient(self.raws.get('youchao', ''))
        self.assertIsNotNone(gradient,
                             "有巢页面缺少标题渐变色")
        self.assertIn('#81c784', gradient.lower(),
                      f"有巢渐变应包含 #81c784，实际: {gradient}")

    def test_suiren_has_gradient_title(self):
        """燧人页面应有橙红色渐变标题"""
        gradient = self._extract_title_gradient(self.raws.get('suiren', ''))
        self.assertIsNotNone(gradient,
                             "燧人页面缺少标题渐变色")
        self.assertIn('#ff8a65', gradient.lower(),
                      f"燧人渐变应包含 #ff8a65，实际: {gradient}")

    def test_fuxi_has_gradient_title(self):
        """伏羲页面应有蓝紫色渐变标题"""
        gradient = self._extract_title_gradient(self.raws.get('fuxi', ''))
        self.assertIsNotNone(gradient,
                             "伏羲页面缺少标题渐变色")
        self.assertIn('#7c8cf8', gradient.lower(),
                      f"伏羲渐变应包含 #7c8cf8，实际: {gradient}")

    def test_all_gradients_are_unique(self):
        """每个故事的渐变色应互不相同"""
        gradients = {}
        for name in STORY_PAGES:
            g = self._extract_title_gradient(self.raws.get(name, ''))
            if g:
                gradients[name] = g
        values = list(gradients.values())
        self.assertEqual(len(values), len(set(values)),
                         f"存在重复的渐变色: {gradients}")

    def test_story_pages_background_consistency(self):
        """所有故事页面的 body 背景色应统一为 #0a0a0f"""
        for name in STORY_PAGES:
            with self.subTest(page=name):
                bg = self._extract_body_background(self.raws.get(name, ''))
                self.assertEqual(bg, '#0a0a0f',
                                 f"{name} 的背景色应为 #0a0a0f，实际: {bg}")

    def test_all_pages_have_webkit_background_clip(self):
        """所有故事页面的 .title-cn 应有 -webkit-background-clip: text"""
        for name in STORY_PAGES:
            with self.subTest(page=name):
                raw = self.raws.get(name, '')
                self.assertIn('-webkit-background-clip: text', raw,
                              f"{name} 缺少 -webkit-background-clip: text")
                self.assertIn('-webkit-text-fill-color: transparent', raw,
                              f"{name} 缺少 -webkit-text-fill-color: transparent")


# ============================================================================
# 测试7：页面共有元素
# ============================================================================

class TestCommonElements(unittest.TestCase):
    """测试所有故事页面的共有元素"""

    @classmethod
    def setUpClass(cls):
        cls.parsers = {}
        cls.raws = {}
        for name, path in STORY_PAGES.items():
            if os.path.exists(path):
                cls.parsers[name] = parse_html(path)
                with open(path, 'r', encoding='utf-8') as f:
                    cls.raws[name] = f.read()

    def test_all_pages_have_canvas(self):
        """所有故事页面都应有 canvas 元素"""
        for name, parser in self.parsers.items():
            with self.subTest(page=name):
                self.assertTrue(parser.has_canvas,
                                f"{name} 页面缺少 canvas 元素")

    def test_all_pages_have_particle_animation(self):
        """所有故事页面都应有粒子动画脚本"""
        for name in STORY_PAGES:
            with self.subTest(page=name):
                raw = self.raws.get(name, '')
                self.assertIn('Particle', raw,
                              f"{name} 页面缺少 Particle 类定义")
                self.assertIn('particleCount', raw,
                              f"{name} 页面缺少 particleCount")
                self.assertIn('requestAnimationFrame', raw,
                              f"{name} 页面缺少 requestAnimationFrame")

    def test_particle_count_is_80(self):
        """所有页面的粒子数量应为 80"""
        for name in STORY_PAGES:
            with self.subTest(page=name):
                raw = self.raws.get(name, '')
                match = re.search(r'particleCount\s*=\s*(\d+)', raw)
                self.assertIsNotNone(match,
                                     f"{name} 页面未找到 particleCount 定义")
                if match:
                    self.assertEqual(int(match.group(1)), 80,
                                     f"{name} 的粒子数应为 80，实际: {match.group(1)}")

    def test_all_pages_have_tracker_js(self):
        """所有页面（含首页）都应引用 tracker.js"""
        all_pages = {**STORY_PAGES, 'index': INDEX_PAGE}
        for name, path in all_pages.items():
            with self.subTest(page=name):
                if os.path.exists(path):
                    with open(path, 'r', encoding='utf-8') as f:
                        raw = f.read()
                    self.assertIn('tracker.js', raw,
                                  f"{name} 页面缺少 tracker.js 引用")

    def test_all_pages_have_header(self):
        """所有故事页面都应有固定 header"""
        for name in STORY_PAGES:
            with self.subTest(page=name):
                raw = self.raws.get(name, '')
                self.assertIn('<header>', raw,
                              f"{name} 页面缺少 header 元素")

    def test_all_story_pages_have_hero_image(self):
        """所有故事页面都应有 hero-image 区域"""
        for name in STORY_PAGES:
            with self.subTest(page=name):
                raw = self.raws.get(name, '')
                self.assertIn('hero-image', raw,
                              f"{name} 页面缺少 hero-image 区域")

    def test_all_images_have_onerror(self):
        """所有故事页面的 img 标签都应有 onerror 容错"""
        for name, parser in self.parsers.items():
            with self.subTest(page=name):
                for img in parser.images:
                    self.assertTrue(img['has_onerror'],
                                    f"{name} 页面的图片 '{img['src']}' 缺少 onerror 属性")

    def test_all_images_have_alt(self):
        """所有故事页面的 img 标签都应有 alt 属性"""
        for name, parser in self.parsers.items():
            with self.subTest(page=name):
                for img in parser.images:
                    self.assertTrue(len(img['alt']) > 0,
                                    f"{name} 页面的图片 '{img['src']}' 缺少 alt 属性")

    def test_header_nav_links(self):
        """所有故事页面的 header 导航应包含首页、神话、故事、AI 四个链接"""
        for name, parser in self.parsers.items():
            with self.subTest(page=name):
                nav_texts = [link['text'] for link in parser.nav_links]
                nav_hrefs = [link['href'] for link in parser.nav_links]
                self.assertIn('首页', nav_texts,
                              f"{name} 页面 nav 缺少'首页'链接")
                self.assertIn('神话', nav_texts,
                              f"{name} 页面 nav 缺少'神话'链接")
                self.assertIn('#story', nav_hrefs,
                              f"{name} 页面 nav 缺少 #story 锚点")
                self.assertIn('#ai', nav_hrefs,
                              f"{name} 页面 nav 缺少 #ai 锚点")


# ============================================================================
# 测试8：移动端适配
# ============================================================================

class TestResponsiveDesign(unittest.TestCase):
    """测试移动端响应式适配"""

    @classmethod
    def setUpClass(cls):
        cls.raws = {}
        all_pages = {**STORY_PAGES, 'index': INDEX_PAGE}
        for name, path in all_pages.items():
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    cls.raws[name] = f.read()

    def test_all_pages_have_media_query(self):
        """所有页面都应有 @media (max-width: 768px) 响应式规则"""
        for name in self.raws:
            with self.subTest(page=name):
                self.assertIn('@media', self.raws[name],
                              f"{name} 页面缺少媒体查询")
                self.assertIn('768px', self.raws[name],
                              f"{name} 页面缺少 768px 断点")

    def test_all_pages_have_mobile_title_size(self):
        """所有页面在移动端应调整标题字号"""
        for name in self.raws:
            with self.subTest(page=name):
                raw = self.raws[name]
                # 检查 media query 内是否有 .title-cn 的字号调整
                media_match = re.search(
                    r'@media\s*\(max-width:\s*768px\)\s*\{(.*)\}',
                    raw, re.DOTALL
                )
                if media_match:
                    media_content = media_match.group(1)
                    self.assertIn('.title-cn', media_content,
                                  f"{name} 的响应式规则中应包含 .title-cn 调整")


# ============================================================================
# 测试9：H1 标题内容
# ============================================================================

class TestH1Titles(unittest.TestCase):
    """测试每个故事页面的 H1 标题"""

    @classmethod
    def setUpClass(cls):
        cls.parsers = {}
        for name, path in STORY_PAGES.items():
            if os.path.exists(path):
                cls.parsers[name] = parse_html(path)

    def test_pangu_h1(self):
        """盘古页面的 H1 应为"盘古开天地" """
        self.assertEqual(self.parsers['pangu'].h1_text, '盘古开天地')

    def test_nvwa_h1(self):
        """女娲页面的 H1 应为"女娲造人" """
        self.assertEqual(self.parsers['nvwa'].h1_text, '女娲造人')

    def test_youchao_h1(self):
        """有巢页面的 H1 应为"有巢构木" """
        self.assertEqual(self.parsers['youchao'].h1_text, '有巢构木')

    def test_suiren_h1(self):
        """燧人页面的 H1 应为"燧人取火" """
        self.assertEqual(self.parsers['suiren'].h1_text, '燧人取火')

    def test_fuxi_h1(self):
        """伏羲页面的 H1 应为"伏羲画卦" """
        self.assertEqual(self.parsers['fuxi'].h1_text, '伏羲画卦')


# ============================================================================
# 测试10：英文名称标签
# ============================================================================

class TestEnglishNames(unittest.TestCase):
    """测试每个故事页面的英文名称"""

    @classmethod
    def setUpClass(cls):
        cls.raws = {}
        for name, path in STORY_PAGES.items():
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    cls.raws[name] = f.read()

    def test_english_names(self):
        """每个故事页面应有正确的英文名"""
        expected = {
            'pangu': 'PANGU',
            'nvwa': 'NVWA',
            'youchao': 'YOUCHAO',
            'suiren': 'SUIREN',
            'fuxi': 'FUXI',
        }
        for name, en_name in expected.items():
            with self.subTest(page=name):
                raw = self.raws.get(name, '')
                self.assertIn(en_name, raw,
                              f"{name} 页面缺少英文名 '{en_name}'")


# ============================================================================
# 测试11：图片路径正确性
# ============================================================================

class TestImagePaths(unittest.TestCase):
    """测试故事页面的图片路径"""

    @classmethod
    def setUpClass(cls):
        cls.parsers = {}
        for name, path in STORY_PAGES.items():
            if os.path.exists(path):
                cls.parsers[name] = parse_html(path)

    def test_image_paths(self):
        """每个故事页面应引用正确的图片文件名"""
        expected_images = {
            'pangu': 'pangu.jpg',
            'nvwa': 'nvwa.jpg',
            'youchao': 'youchao.jpg',
            'suiren': 'suiren.jpg',
            'fuxi': 'fuxi.jpg',
        }
        for name, expected_src in expected_images.items():
            if name in self.parsers:
                with self.subTest(page=name):
                    images = self.parsers[name].images
                    image_srcs = [img['src'] for img in images]
                    self.assertIn(expected_src, image_srcs,
                                  f"{name} 页面应引用 '{expected_src}'，实际图片: {image_srcs}")


# ============================================================================
# 测试12：Canvas 动画背景色一致性
# ============================================================================

class TestCanvasBackgroundConsistency(unittest.TestCase):
    """测试 Canvas 粒子动画的背景色一致性"""

    @classmethod
    def setUpClass(cls):
        cls.raws = {}
        for name, path in STORY_PAGES.items():
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    cls.raws[name] = f.read()

    def test_canvas_fill_style_consistency(self):
        """所有故事页面的 Canvas fillStyle 应为 rgba(10,10,15,0.1)"""
        for name in STORY_PAGES:
            with self.subTest(page=name):
                raw = self.raws.get(name, '')
                self.assertIn('rgba(10,10,15,0.1)', raw,
                              f"{name} 的 Canvas fillStyle 应为 rgba(10,10,15,0.1)")


# ============================================================================
# 测试13：页面内容不应包含 placeholder 故事
# ============================================================================

class TestNoPlaceholderStories(unittest.TestCase):
    """确保不再出现被替换的 placeholder 故事"""

    @classmethod
    def setUpClass(cls):
        if os.path.exists(INDEX_PAGE):
            with open(INDEX_PAGE, 'r', encoding='utf-8') as f:
                cls.raw = f.read()
        else:
            cls.raw = ""

    def test_no_houyi(self):
        """首页不应包含后羿射日"""
        self.assertNotIn('后羿射日', self.raw)

    def test_no_jingwei(self):
        """首页不应包含精卫填海"""
        self.assertNotIn('精卫填海', self.raw)

    def test_no_kuafu(self):
        """首页不应包含夸父追日"""
        self.assertNotIn('夸父追日', self.raw)

    def test_no_gunyu(self):
        """首页不应包含鲧禹治水"""
        self.assertNotIn('鲧禹治水', self.raw)


# ============================================================================
# 测试14：页面间链接一致性（交叉验证）
# ============================================================================

class TestCrossPageConsistency(unittest.TestCase):
    """交叉验证页面间的引用一致性"""

    @classmethod
    def setUpClass(cls):
        cls.raws = {}
        all_pages = {**STORY_PAGES, 'index': INDEX_PAGE}
        for name, path in all_pages.items():
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    cls.raws[name] = f.read()

    def test_all_linked_files_exist(self):
        """所有内部链接指向的文件都应存在"""
        for name, raw in self.raws.items():
            with self.subTest(page=name):
                # 找出所有指向 .html 文件的相对链接
                html_links = re.findall(r'href="([^"]*\.html)"', raw)
                for link in html_links:
                    # 跳过绝对 URL
                    if link.startswith('http'):
                        continue
                    filepath = os.path.join(BASE_DIR, link)
                    self.assertTrue(os.path.exists(filepath),
                                    f"{name} 页面链接 '{link}' 指向的文件不存在: {filepath}")

    def test_index_links_match_story_pages(self):
        """首页 Timeline 中的链接应与故事页面文件名匹配"""
        index_raw = self.raws.get('index', '')
        expected_files = ['pangu.html', 'nvwa.html', 'youchao.html', 'suiren.html', 'fuxi.html']
        for filename in expected_files:
            with self.subTest(file=filename):
                self.assertIn(f'href="{filename}"', index_raw,
                              f"首页 Timeline 中缺少到 '{filename}' 的链接")


# ============================================================================
# 测试15：Section 结构标准化
# ============================================================================

class TestSectionStructure(unittest.TestCase):
    """测试故事页面的 section 结构标准化"""

    @classmethod
    def setUpClass(cls):
        cls.raws = {}
        for name, path in STORY_PAGES.items():
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    cls.raws[name] = f.read()

    def test_story_section_has_h2_story(self):
        """所有故事页面的 story section 应有 H2 标题 'Story' """
        for name in STORY_PAGES:
            with self.subTest(page=name):
                raw = self.raws.get(name, '')
                # 在 story section 中查找 H2
                story_section = re.search(
                    r'<section id="story">(.*?)</section>',
                    raw, re.DOTALL
                )
                self.assertIsNotNone(story_section,
                                     f"{name} 缺少 story section")
                if story_section:
                    self.assertIn('<h2>Story</h2>', story_section.group(1),
                                  f"{name} 的 story section 缺少 H2 'Story'")

    def test_ai_section_has_h2_ai_metaphor(self):
        """所有故事页面的 AI section 应有 H2 标题 'AI Metaphor' """
        for name in STORY_PAGES:
            with self.subTest(page=name):
                raw = self.raws.get(name, '')
                ai_section = re.search(
                    r'<section id="ai">(.*?)</section>',
                    raw, re.DOTALL
                )
                self.assertIsNotNone(ai_section,
                                     f"{name} 缺少 ai section")
                if ai_section:
                    self.assertIn('AI Metaphor', ai_section.group(1),
                                  f"{name} 的 ai section 缺少 H2 'AI Metaphor'")

    def test_ai_section_has_grid(self):
        """所有故事页面的 AI section 应有 ai-grid 容器"""
        for name in STORY_PAGES:
            with self.subTest(page=name):
                raw = self.raws.get(name, '')
                self.assertIn('class="ai-grid"', raw,
                              f"{name} 缺少 ai-grid 容器")


# ============================================================================
# 主程序
# ============================================================================

if __name__ == '__main__':
    unittest.main(verbosity=2)
