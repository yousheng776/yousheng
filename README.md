# yousheng · 角色陪伴网站生成器

用角色名和作品 IP 生成一个本地运行的陪伴式角色网站。

技能包不带任何角色图。官方图在项目里现场下载到 `assets/refs/`，只做对照。Q 版和陪伴场景交给豆包生成。

## 环境

- DeepSeek Harness
- Python 3.9 以上
- Pillow、numpy
- 豆包桌面端。没有也能用，走 `doubao_inbox/` 的手动流程
- Chrome 或 Edge，语音输入要 localhost

## 安装

把整个 `yousheng` 文件夹放到：

- 全局：`~/.dsh/skills/yousheng`
- 或项目：`<项目>/.dsh/skills/yousheng`

重启 DSH，技能列表里会出现 `yousheng`。

也可以用仓库里的一键安装：

```bash
./install.sh
```

它会把整个目录复制到 `~/.dsh/skills/yousheng`。

## 快速开始

对 AI 说：

> 用 yousheng 给《作品》的某角色做一个陪伴网站，输出到 ~/Documents/xxx。

也可以手动：

```bash
python3 scripts/scaffold.py \
  --name "角色名" --ip "作品名" \
  --out ~/Documents/character-site \
  --app-name "站点名" --code "编号"
```

然后按 `SKILL.md` 的七步走。模板里的示例角色和示例台词只用于跑通页面，交付前必须整份重写。

## 图片从哪来

技能包只有中性占位图，没有角色图。

1. AI 搜索该角色的官方立绘和皮肤图，下载到项目的 `assets/refs/`。
2. 把官方图发给豆包，先让它描述画风，再逐套生成 Q 版。
3. 每套皮肤八种表情，至少三个动作，逐张对照官方图核对。
4. 四间陪伴场景也用豆包生成，接入时用 `painted: true` 和 `#stageFore`。

官方图只做对照，不参与运行，也不要放进公开仓库。

## 目录

```
SKILL.md              技能定义与七步流程
references/           资料查法、豆包流程、去 AI、人设、素材、代码
scripts/              scaffold、Q 版处理、场景接入
templates/site/       站点模板（中性占位图）
```

## 依赖安装

```bash
pip install -r requirements.txt
```

## 许可

代码和文档用 MIT。角色名称、设定和官方图归原权利方。生成的角色图仅限个人使用，不要商用，不要公开传播官方素材。
