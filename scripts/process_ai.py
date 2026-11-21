#!/usr/bin/env python3
"""把豆包出的白底 Q 版处理成站点用的透明 PNG。

用法：
  python3 process_ai.py 输入.png 输出.png [水印区高度] [头像输出]

例：
  python3 process_ai.py raw.png assets/char/vow_calm.png 96 assets/faces/vow.png
"""
import sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np


def process(src_path, out_path, crop_bottom=0, face_path=None):
    src = Image.open(src_path).convert("RGB")
    w, h = src.size
    work = src.copy()
    sent = (255, 0, 255)
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
               (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        try:
            ImageDraw.floodfill(work, xy, sent, thresh=26)
        except Exception:
            pass
    arr = np.array(work)
    mask = (arr[:, :, 0] > 250) & (arr[:, :, 1] < 8) & (arr[:, :, 2] > 250)
    alpha = np.where(mask, 0, 255).astype(np.uint8)
    if crop_bottom:
        alpha[h - crop_bottom - 20:h, int(w * 0.5):w] = 0
    a = Image.fromarray(alpha, "L").filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(0.7))
    rgba = src.convert("RGBA")
    rgba.putalpha(a)
    arr2 = np.array(rgba).astype(np.float32)
    al = arr2[:, :, 3:4] / 255.0
    edge = (al > 0.02) & (al < 0.98)
    rgb = arr2[:, :, :3]
    rgb_new = (rgb - (1.0 - al) * 255.0) / np.maximum(al, 0.02)
    arr2[:, :, :3] = np.where(edge, np.clip(rgb_new, 0, 255), rgb)
    rgba = Image.fromarray(arr2.astype(np.uint8), "RGBA")
    bbox = a.getbbox()
    if bbox:
        rgba = rgba.crop((max(0, bbox[0] - 6), max(0, bbox[1] - 6),
                          min(w, bbox[2] + 6), min(h, bbox[3] + 6)))
    cw, ch = rgba.size
    scale = min(600 / cw, 845 / ch)
    nw, nh = int(cw * scale), int(ch * scale)
    rgba = rgba.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (640, 935), (0, 0, 0, 0))
    canvas.alpha_composite(rgba, ((640 - nw) // 2, 895 - nh))
    canvas.save(out_path)
    if face_path:
        fb = canvas.getbbox()
        top = fb[1] if fb else 0
        head_h = int((fb[3] - top) * 0.38) if fb else 300
        box = (max(0, 640 // 2 - 150), top, min(640, 640 // 2 + 150), top + head_h + 40)
        face = canvas.crop(box).resize((360, 360), Image.LANCZOS)
        face.save(face_path)
    print("saved", out_path, canvas.size)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    process(sys.argv[1], sys.argv[2],
            int(sys.argv[3]) if len(sys.argv) > 3 else 0,
            sys.argv[4] if len(sys.argv) > 4 else None)
