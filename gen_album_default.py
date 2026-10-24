# -*- coding: utf-8 -*-
"""生成极悦界默认封面占位图 album-default.jpeg（512x512）
风格：品牌蓝对角渐变 + 中央白色音符，对齐 LocalSongCover 渐变占位
"""
from PIL import Image, ImageDraw, ImageFont

SIZE = 512
C1 = (47, 111, 237)     # #2F6FED 品牌蓝（深）
C2 = (90, 143, 255)     # #5A8FFF 品牌蓝（浅）

img = Image.new("RGB", (SIZE, SIZE), C1)
draw = ImageDraw.Draw(img)

# 对角渐变（左上 #2F6FED -> 右下 #5A8FFF）
for y in range(SIZE):
    t = y / (SIZE - 1)
    for x in range(0, SIZE, 2):
        s = (x / (SIZE - 1) + t) / 2
        c = tuple(int(C1[i] + (C2[i] - C1[i]) * s) for i in range(3))
        draw.line([(x, y), (min(x + 1, SIZE - 1), y)], fill=c)

# 中央白色音符（♫ 双八分音符，Segoe UI Symbol）
try:
    font = ImageFont.truetype(r"C:\Windows\Fonts\seguisym.ttf", 300)
except Exception:
    font = ImageFont.load_default()

note = "\u266B"  # ♫
bbox = draw.textbbox((0, 0), note, font=font)
w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
x = (SIZE - w) // 2 - bbox[0]
y = (SIZE - h) // 2 - bbox[1]
# 音符轻微上移，视觉居中
y -= 12
draw.text((x, y), note, font=font, fill=(255, 255, 255))

# 音符外圈加一层非常淡的柔光（叠加一个同色低透明度圆，增加精致感）
glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([SIZE * 0.14, SIZE * 0.14, SIZE * 0.86, SIZE * 0.86],
           fill=(255, 255, 255, 14))
img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")

out = r"E:\xunwu\MusicFreeApp\MusicFree\src\assets\imgs\album-default.jpeg"
img.save(out, "JPEG", quality=92)
print("saved:", out)
