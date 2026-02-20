#!/usr/bin/env python3
"""
原初黑洞主题Logo设计
灵感：原初黑洞、道家思想、黎曼几何
"""

import os
import math

OUTPUT_DIR = '/Users/jackiezhan/github/yuanchu.ai/logo'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============ 设计1: 原初黑洞 - 抽象同心圆 ============
def create_primordial_blackhole():
    """原初黑洞 - 引力透镜效果，抽象线条"""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="100%" height="100%" fill="#000000"/>
  <g fill="none" stroke="white" stroke-width="2">
'''
    
    center = 256
    for i in range(12):
        radius = 40 + i * 28
        alpha = 255 - i * 18
        distortion = 1 - (radius / 240) ** 2
        if distortion < 0:
            distortion = 0
        r = radius * (1 - distortion * 0.15)
        
        points = []
        for angle in range(360):
            rad = math.radians(angle)
            x = center + r * math.cos(rad)
            y = center + r * math.sin(rad)
            points.append(f"{x:.1f},{y:.1f}")
        
        svg += f'    <polygon points="{" ".join(points)}" fill="none" stroke="rgba(255,255,255,{alpha/255})" stroke-width="2"/>\n'
    
    # 中心奇点
    svg += '    <circle cx="256" cy="256" r="8" fill="white"/>\n'
    svg += '    <circle cx="256" cy="256" r="6" fill="white"/>\n'
    svg += '    <circle cx="256" cy="256" r="4" fill="white"/>\n'
    svg += '  </g>\n</svg>'
    
    with open(f'{OUTPUT_DIR}/v1-primordial-blackhole.svg', 'w') as f:
        f.write(svg)
    print("v1-primordial-blackhole.svg ✓")

# ============ 设计2: 史瓦西半径 ============
def create_schwarzschild():
    """史瓦西半径 - 几何化的黑洞边界"""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="100%" height="100%" fill="#000000"/>
  <g fill="none" stroke="rgba(200,200,200,0.8)" stroke-width="2">
'''
    
    center = 256
    # 内部引力线
    for i in range(60):
        angle = i * 6
        rad = math.radians(angle)
        x = center + 180 * math.cos(rad)
        y = center + 180 * math.sin(rad)
        ix = center + 108 * math.cos(rad)
        iy = center + 108 * math.sin(rad)
        svg += f'    <line x1="{x:.1f}" y1="{y:.1f}" x2="{ix:.1f}" y2="{iy:.1f}" stroke="rgba(200,200,200,0.6)"/>\n'
    
    # 中心奇点
    svg += '    <circle cx="256" cy="256" r="6" fill="white"/>\n'
    
    # 事件视界
    svg += f'    <circle cx="256" cy="256" r="180" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="3" stroke-dasharray="8,4"/>\n'
    # 外部圆环
    svg += f'    <circle cx="256" cy="256" r="220" fill="none" stroke="rgba(100,100,100,0.5)"/>\n'
    
    svg += '  </g>\n</svg>'
    
    with open(f'{OUTPUT_DIR}/v2-schwarzschild.svg', 'w') as f:
        f.write(svg)
    print("v2-schwarzschild.svg ✓")

# ============ 设计3: 道生一 ============
def create_tao_one():
    """道生一 - 一个中心点"""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="100%" height="100%" fill="#000000"/>
  <g>
    <!-- 中心奇点 - 道生一 -->
    <circle cx="256" cy="256" r="16" fill="white"/>
    <circle cx="256" cy="256" r="12" fill="white"/>
    <circle cx="256" cy="256" r="8" fill="white"/>
    <circle cx="256" cy="256" r="4" fill="white"/>
    <!-- 极细外环 -->
    <circle cx="256" cy="256" r="100" fill="none" stroke="rgba(150,150,150,0.4)"/>
  </g>
</svg>'''
    
    with open(f'{OUTPUT_DIR}/v3-tao-one.svg', 'w') as f:
        f.write(svg)
    print("v3-tao-one.svg ✓")

# ============ 设计4: 一生二 ============
def create_tao_two():
    """一生二 - 点 + 同心环"""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="100%" height="100%" fill="#000000"/>
  <g fill="none" stroke="rgba(220,220,220,0.9)" stroke-width="3">
'''
    
    svg += '    <circle cx="256" cy="256" r="80"/>\n'
    svg += '    <circle cx="256" cy="256" r="140"/>\n'
    svg += '  </g>\n  <g>\n'
    svg += '    <circle cx="256" cy="256" r="16" fill="white"/>\n'
    svg += '    <circle cx="256" cy="256" r="10" fill="white"/>\n'
    svg += '    <circle cx="256" cy="256" r="5" fill="white"/>\n'
    svg += '  </g>\n</svg>'
    
    with open(f'{OUTPUT_DIR}/v4-tao-two.svg', 'w') as f:
        f.write(svg)
    print("v4-tao-two.svg ✓")

# ============ 设计5: 二生三 ============
def create_tao_three():
    """二生三 - 点 + 三环 + 引力线"""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="100%" height="100%" fill="#000000"/>
  <g fill="none" stroke="rgba(200,200,200,0.8)" stroke-width="2">
'''
    
    # 三个同心环
    for r in [70, 120, 170]:
        svg += f'    <circle cx="256" cy="256" r="{r}"/>\n'
    
    svg += '  </g>\n  <g stroke="rgba(100,100,100,0.6)" stroke-width="1">\n'
    # 引力线
    for angle in range(0, 360, 45):
        rad = math.radians(angle)
        x1 = 256 + 30 * math.cos(rad)
        y1 = 256 + 30 * math.sin(rad)
        x2 = 256 + 200 * math.cos(rad)
        y2 = 256 + 200 * math.sin(rad)
        svg += f'    <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>\n'
    
    svg += '  </g>\n  <g>\n'
    svg += '    <circle cx="256" cy="256" r="12" fill="white"/>\n'
    svg += '    <circle cx="256" cy="256" r="6" fill="white"/>\n'
    svg += '  </g>\n</svg>'
    
    with open(f'{OUTPUT_DIR}/v5-tao-three.svg', 'w') as f:
        f.write(svg)
    print("v5-tao-three.svg ✓")

# ============ 设计6: 三生万物 ============
def create_tao_all():
    """三生万物 - 多层级系统"""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="100%" height="100%" fill="#000000"/>
  <g fill="none" stroke="rgba(200,200,200,0.7)" stroke-width="2">
'''
    
    # 五个同心环
    for i, r in enumerate([50, 90, 130, 170, 210]):
        gray = 220 - i * 25
        svg += f'    <circle cx="256" cy="256" r="{r}" stroke="rgba({gray},{gray},{gray},0.8)"/>\n'
    
    svg += '  </g>\n  <g stroke="rgba(80,80,80,0.5)" stroke-width="1">\n'
    # 十二个方向的引力线
    for angle in range(0, 360, 30):
        rad = math.radians(angle)
        x1 = 256 + 20 * math.cos(rad)
        y1 = 256 + 20 * math.sin(rad)
        x2 = 256 + 230 * math.cos(rad)
        y2 = 256 + 230 * math.sin(rad)
        svg += f'    <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>\n'
    
    svg += '  </g>\n  <g>\n'
    svg += '    <circle cx="256" cy="256" r="12" fill="white"/>\n'
    svg += '    <circle cx="256" cy="256" r="6" fill="white"/>\n'
    svg += '  </g>\n</svg>'
    
    with open(f'{OUTPUT_DIR}/v6-tao-universe.svg', 'w') as f:
        f.write(svg)
    print("v6-tao-universe.svg ✓")

# ============ 设计7: 黎曼几何 ============
def create_riemann():
    """黎曼几何 - 扭曲的网格线"""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="100%" height="100%" fill="#000000"/>
  <g fill="none" stroke="rgba(150,150,150,0.7)" stroke-width="1.5">
'''
    
    center = 256
    # 径向线
    for i in range(16):
        angle = i * 22.5
        rad = math.radians(angle)
        x1 = center + 240 * math.cos(rad)
        y1 = center + 240 * math.sin(rad)
        x2 = center + 40 * math.cos(rad)
        y2 = center + 40 * math.sin(rad)
        svg += f'    <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>\n'
    
    # 同心圆
    for i, r in enumerate([60, 100, 140, 180, 220]):
        gray = 180 - i * 25
        svg += f'    <circle cx="256" cy="256" r="{r}" stroke="rgba({gray},{gray},{gray},0.7)"/>\n'
    
    svg += '  </g>\n  <g>\n'
    svg += '    <circle cx="256" cy="256" r="10" fill="white"/>\n'
    svg += '  </g>\n</svg>'
    
    with open(f'{OUTPUT_DIR}/v7-riemann-geometry.svg', 'w') as f:
        f.write(svg)
    print("v7-riemann-geometry.svg ✓")

# ============ 设计8: 原初奇点 ============
def create_primordial_singularity():
    """原初奇点 - 极简抽象"""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="100%" height="100%" fill="#000000"/>
  <g fill="none" stroke="white" stroke-width="2">
'''
    
    # 向内弯曲的圆环
    for thickness in range(8):
        r = 120 + thickness * 8
        bend = 0.92 + thickness * 0.01
        points = []
        for angle in range(360):
            rad = math.radians(angle)
            x = 256 + r * bend * math.cos(rad)
            y = 256 + r * bend * math.sin(rad)
            points.append(f"{x:.1f},{y:.1f}")
        
        alpha = 255 - thickness * 25
        svg += f'    <polygon points="{" ".join(points)}" fill="none" stroke="rgba(255,255,255,{alpha/255})" stroke-width="3"/>\n'
    
    svg += '  </g>\n  <g>\n'
    svg += '    <circle cx="256" cy="256" r="8" fill="white"/>\n'
    svg += '  </g>\n</svg>'
    
    with open(f'{OUTPUT_DIR}/v8-primordial-singularity.svg', 'w') as f:
        f.write(svg)
    print("v8-primordial-singularity.svg ✓")

# ============ 设计9: 吸积盘 ============
def create_accretion_disk():
    """吸积盘 - 抽象螺旋"""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="100%" height="100%" fill="#000000"/>
  <g fill="white">
'''
    
    center = 256
    # 螺旋点
    for arm in range(3):
        for t in range(80, 220):
            angle = t * 0.03 + arm * 2 * math.pi / 3
            r = t * 0.8
            
            # 螺旋扭曲
            x = center + r * math.cos(angle + t * 0.005)
            y = center + r * math.sin(angle + t * 0.005)
            
            alpha = 1 - t/220
            size = max(1, 4 - int(t/60))
            svg += f'    <circle cx="{x:.1f}" cy="{y:.1f}" r="{size:.1f}" fill="rgba(255,255,255,{alpha:.2f})"/>\n'
    
    # 中心黑洞
    svg += '    <circle cx="256" cy="256" r="15" fill="white"/>\n'
    svg += '    <circle cx="256" cy="256" r="10" fill="white"/>\n'
    svg += '    <circle cx="256" cy="256" r="5" fill="white"/>\n'
    svg += '  </g>\n</svg>'
    
    with open(f'{OUTPUT_DIR}/v9-accretion-disk.svg', 'w') as f:
        f.write(svg)
    print("v9-accretion-disk.svg ✓")

# ============ 设计10: 道家黑洞 ============
def create_tao_blackhole():
    """道家黑洞 - 结合太极思想"""
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="100%" height="100%" fill="#000000"/>
  <!-- 外部圆 -->
  <circle cx="256" cy="256" r="200" fill="none" stroke="rgba(200,200,200,0.8)" stroke-width="3"/>
  
  <!-- 太极图 - 但中心是黑洞 -->
  <!-- 阳鱼(白) -->
  <ellipse cx="196" cy="256" rx="120" ry="120" fill="white"/>
  <circle cx="196" cy="226" r="30" fill="black"/>
  
  <!-- 阴鱼(黑) -->
  <ellipse cx="316" cy="256" rx="120" ry="120" fill="none" stroke="white" stroke-width="3"/>
  <circle cx="316" cy="286" r="30" fill="white"/>
  
  <!-- 中心黑洞奇点 -->
  <circle cx="256" cy="256" r="12" fill="white"/>
  <circle cx="256" cy="256" r="8" fill="white"/>
  <circle cx="256" cy="256" r="4" fill="white"/>
</svg>'''
    
    with open(f'{OUTPUT_DIR}/v10-tao-blackhole.svg', 'w') as f:
        f.write(svg)
    print("v10-tao-blackhole.svg ✓")

if __name__ == '__main__':
    print("=" * 50)
    print("生成原初黑洞主题 Logo")
    print("=" * 50)
    
    create_primordial_blackhole()
    create_schwarzschild()
    create_tao_one()
    create_tao_two()
    create_tao_three()
    create_tao_all()
    create_riemann()
    create_primordial_singularity()
    create_accretion_disk()
    create_tao_blackhole()
    
    print("=" * 50)
    print("完成！生成 10 个 SVG Logo 方案")
    print(f"路径: {OUTPUT_DIR}")
    print("=" * 50)
