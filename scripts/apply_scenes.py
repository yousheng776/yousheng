#!/usr/bin/env python3
"""把 doubao_inbox 里的四张室内背景接进站点。

用法：
  python3 apply_scenes.py [项目目录]

图片命名：cafe.png / library.png / classroom.png / home.png，也接受 jpg、jpeg、webp。
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
INBOX = ROOT / "doubao_inbox"
OUT = ROOT / "assets" / "scenes"
NAMES = ["cafe", "library", "classroom", "home"]
EXTS = [".png", ".jpg", ".jpeg", ".webp"]


def find(name):
    for ext in EXTS:
        p = INBOX / (name + ext)
        if p.exists():
            return p
    return None


def fit(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    target = 1600 / 900
    if w / h > target:
        nw = int(h * target)
        im = im.crop(((w - nw) // 2, 0, (w + nw) // 2, h))
    else:
        nh = int(w / target)
        im = im.crop((0, (h - nh) // 2, w, (h + nh) // 2))
    im = im.resize((1600, 900), Image.LANCZOS)
    mask = Image.new("L", (1600, 900), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([-120, -140, 1720, 1040], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(150))
    dark = Image.new("RGB", (1600, 900), (8, 8, 12))
    return Image.composite(im, dark, mask)


def main():
    done = 0
    for name in NAMES:
        src = find(name)
        if not src:
            print(f"跳过 {name}：doubao_inbox 里没有 {name}.png/jpg")
            continue
        OUT.mkdir(parents=True, exist_ok=True)
        fit(src).save(OUT / f"room_{name}.jpg", quality=92)
        print(f"已接入 {src.name} -> assets/scenes/room_{name}.jpg")
        done += 1
    print(f"完成 {done}/4。刷新页面看效果。")


if __name__ == "__main__":
    main()
