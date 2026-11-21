#!/usr/bin/env python3
"""Scaffold a companion character site from the bundled template.

Usage:
  python3 scaffold.py --name 格芮芙 --ip 无期迷途 --out ~/Documents/gref-site \
      --app-name 永世爱恋 --code MBCC-S-214

The template ships with a demo character's data. Every line of dialogue must be
rewritten for the real character before delivery.
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

TOKENS = {
    "格芮芙": "{name}",
    "永世爱恋": "{app_name}",
    "MBCC-S-214": "{code}",
    "无期迷途": "{ip}",
}

TEXT_SUFFIXES = {".html", ".css", ".js", ".md", ".json", ".txt", ".svg"}


def replace_tokens(root: Path, values: dict) -> None:
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        text = path.read_text(encoding="utf-8")
        updated = text
        for key, tpl in TOKENS.items():
            updated = updated.replace(key, tpl.format(**values))
        if updated != text:
            path.write_text(updated, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="生成角色陪伴网站的本地项目")
    parser.add_argument("--name", required=True, help="角色名")
    parser.add_argument("--ip", required=True, help="作品 IP")
    parser.add_argument("--out", required=True, help="输出目录")
    parser.add_argument("--app-name", default="", help="站点名，默认用角色名")
    parser.add_argument("--code", default="", help="角色编号，可留空")
    parser.add_argument("--force", action="store_true", help="输出目录非空时覆盖")
    args = parser.parse_args()

    values = {
        "name": args.name,
        "ip": args.ip,
        "app_name": args.app_name or f"{args.name} · 陪伴",
        "code": args.code or "UNKNOWN",
    }

    template = Path(__file__).resolve().parent.parent / "templates" / "site"
    out = Path(args.out).expanduser().resolve()

    if out.exists() and any(out.iterdir()) and not args.force:
        print(f"目录非空：{out}\n加 --force 覆盖，或换一个目录。", file=sys.stderr)
        return 2

    if out.exists() and args.force:
        shutil.rmtree(out)
    shutil.copytree(template, out)
    replace_tokens(out, values)

    # 豆包出图工具和收件箱
    skill_root = Path(__file__).resolve().parent.parent
    (out / "tools").mkdir(exist_ok=True)
    for name in ("process_ai.py", "apply_scenes.py"):
        shutil.copy2(skill_root / "scripts" / name, out / "tools" / name)
    (out / "assets" / "refs").mkdir(parents=True, exist_ok=True)
    inbox = out / "doubao_inbox"
    inbox.mkdir(exist_ok=True)
    (inbox / "README.md").write_text(
        f"""# 豆包出图收件箱

## Q 版

把每套皮肤的官方立绘发给豆包，先让它描述，再逐张出 Q 版。白底原图按
`<皮肤>_<姿态>.png` 命名放进这里，例如 `vow_calm.png`、`vow_shy.png`。

处理：

```bash
python3 tools/process_ai.py vow_calm.png assets/char/vow_calm.png 96 assets/faces/vow.png
```

八种表情：calm、smile、shy、joy、sad、surprised、sleepy、frenzy。
每套至少三个动作。提示词不写作品名和角色名。

## 场景

四张室内背景按 `cafe.png`、`library.png`、`classroom.png`、`home.png` 命名放进这里。

```bash
python3 tools/apply_scenes.py .
```

桌子和道具画进背景，人物用 `painted: true` 和 `#stageFore` 接。
""",
        encoding="utf-8",
    )

    meta = {
        "character": values["name"],
        "ip": values["ip"],
        "appName": values["app_name"],
        "code": values["code"],
        "skins": [],
        "officialVoiceSources": [],
        "researchNotes": [],
    }
    (out / "character.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (out / "CHARACTER.md").write_text(
        f"""# {values['name']} · 人设卡

- 作品：{values['ip']}
- 站点名：{values['app_name']}
- 编号：{values['code']}

## 皮肤
（逐个列出官方皮肤名、上线时间、官方图来源）

## 语音
（列出官方语音页链接、抓到的条数、哪些用于点触/问候/闲置）

## 性格
（底色、成长、缺点、习惯、关系）

## 语言风格
（句子长度、称呼、口癖、禁用品）

## 边界
（哪些话题会低落，哪些身体接触会拒绝，不同亲密度怎么说）
""",
        encoding="utf-8",
    )

    print(f"已生成：{out}")
    print("接下来：")
    print("1. 按 references/research.md 查官方皮肤、语音和人设，官方图下载到 assets/refs/，填进 CHARACTER.md。")
    print("2. 把每套皮肤的立绘发给豆包，按 references/doubao.md 出 Q 版，放进 doubao_inbox/。")
    print("3. 小红书和抖音补二创，按 references/persona.md 写人设卡和语言库。")
    print("4. 每条语言过 references/deai.md 的自检表。")
    print("5. 重写 js/persona.js，改 js/app.js 的 SKINS 和 css 配色。")
    print("6. 用豆包出四间场景，跑 tools/apply_scenes.py .，再起服务验收。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
