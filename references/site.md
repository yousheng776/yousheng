# 代码结构

纯静态，没有构建步骤。三个文件撑起全部逻辑。

```
index.html          页面结构
css/style.css       全部样式
js/app.js           交互、计时、提醒、皮肤切换
js/persona.js       台词、情绪、亲密度、触碰、放置语言
assets/             图片
```

## 一、persona.js

挂到 `window.GF`，导出：

| 成员 | 作用 |
|---|---|
| `P` | 全部文案与配置 |
| `reply(text, skin)` | 根据输入匹配话题，返回 `{text, exp, mood, topic}` |
| `touch(zone, count, aff)` | 按部位和次数返回一句，高好感换亲近池 |
| `placeLine(skin)` | 放置语言 |
| `voiceLine(skin, kind)` | 官方原话，缺省回落到基础皮肤 |
| `studyLine(hour)` | 学习陪跑按小时取句 |
| `opening(date)` | 按时段的开场白 |
| `awayLine(hours)` | 隔了多久回来的第一句 |

`P` 的主要字段：

```js
P = {
  name, code, title,
  openings: { dawn, morning, noon, afternoon, evening, night, late },
  away: { short, day, long },
  topics: [{ id, kw: [], pri?, exp, mood, aff, lines: [], hi?: [] }],
  fallback: [], fallbackQuestion: [], fallbackEcho: [],
  touch: { head: { exp, mood, first, lines: [], warm: [] }, ... },
  place: { 皮肤key: [十二条] },
  voice: { base: {...}, 皮肤key: {...} },
  study: { start, hourly, close, praise, slack },
  moods: {...}
}
```

加话题：往 `topics` 里加一项。`kw` 越长分越高，同分看顺序。想让某个话题优先，加 `pri`。

加皮肤：在 `app.js` 的 `SKINS` 里加一项。

## 二、app.js 的 SKINS

```js
vow: {
  name: '皮肤名', short: '短名',
  actor: true,                 // 有 Q 版就 true，纯原画 false
  face: 'assets/faces/x.png',  // 聊天头像
  thumb: 'assets/char/x.png',  // 皮肤按钮
  line: '这一套的场景描述',
  exp: { calm:'idle', joy:'happy', shy:'shy', ... }  // 情绪到姿态文件的映射
}
```

`actor: false` 时用整张场景图，点触面板改成按钮网格。

## 三、点触

八个区在 `TOUCH_ZONES` 里，坐标是人物图的百分比。点击按 `zoneFromPoint` 分区，透明像素用 canvas 的 alpha 判断，点空不触发。每个区对应一个 `react-*` 动画，在 `css/style.css` 末尾。

加一个动作：把 PNG 放进 `assets/char/`，在 `exp` 里映射一个情绪即可。每套皮肤都要有八种表情和至少三个动作，图从豆包来，按 `exp` 映射。

## 四、陪伴场景

`#focus` 是全屏场景，`SCENES` 分两类：

```js
vow: { type: 'art', img: 'scenes/portrait.jpg', skin: 'vow' }
cafe: { type: 'room', img: 'scenes/room_cafe.jpg' }
```

- `art`：官方立绘铺满，皮肤跟着画面走，不显示皮肤按钮。
- `room`：背景图 + `#sceneActor`（Q 版）+ `#stageFore`（同一张背景裁掉上半，盖住人物下半身）。`painted: true` 的室内把桌子和道具画进背景，不再用 `#tableFg`。`#dateSkins` 显示三套皮肤，`skinChoice` 是场景里选的，`sceneSkin` 用来取台词。
- 点人物按部位分区，点道具走 `P.tableTouch`，每个道具一个动作一句台词。
- 进场 `openFocus` 会做一次招手，2.6 秒后回到平静。
- 倒计时结束：室内换 `joy` 姿态，原画弹 `#endImg`。

室内背景按桌沿高度用 `clip-path: inset(X% 0 0 0)` 做前景层，人物上半身露在桌沿上方，下半身被前景盖住。X 按每张图的桌沿调：咖啡馆 64%，图书馆 84%，教室 60%，家里 64%。

四间室内的背景用豆包生成，流程和提示词见 `references/doubao.md`。桌子和道具画进背景，不再单独叠 `table_fg.png`。

## 五、陪伴计时

`focusState` 管三种模式。`setInterval` 每秒跑一次，负责计时、间隔提醒、五分钟放置语言。倒计时和间隔都能填分钟数，输入框在 `renderFocusOpts` 里。

放置语言取 `placeLine(sceneSkin)`，每个皮肤十二条。

## 六、大模型（可选）

`state.llm` 存接口地址、密钥、模型和开关。`buildLLMPrompt()` 拼人格，`llmReply()` 发请求，`respond()` 优先走大模型，失败回落本地。

换角色时必须重写 `buildLLMPrompt()`，模板里写的是示例角色。密钥只存 `localStorage`，请求直接发给你填的接口。

## 七、数据

存在 `localStorage` 的 `gref.v2`。亲密度、见面次数、约定、学习记录、触碰次数、皮肤解锁状态都在里面。

换角色时改存储键，避免旧数据串味。

## 八、本地运行

```bash
python3 -m http.server 8781
```

语音输入必须走 localhost 或 https，Chrome 或 Edge。

## 九、改配色的位置

`css/style.css` 顶部的 `:root`：主色、辅色、金色、珍珠白。每个皮肤的 `body[data-skin="x"]` 可以单独覆盖。

## 十、素材处理

Q 版白底原图：

```bash
python3 scripts/process_ai.py 输入.png assets/char/<皮肤>_<姿态>.png 96 assets/faces/<皮肤>.png
```

场景图，先把四张存进 `doubao_inbox/`：

```bash
python3 scripts/apply_scenes.py <项目目录>
```

脚本在 skill 的 `scripts/` 下。项目里没有 `tools/` 就把两个脚本复制进去。

## 十一、加一个新模块

1. `index.html` 里加按钮，`data-act="xxx"`。
2. `#rituals` 的点击分发里加 `if (act === 'xxx') openXxx()`。
3. 写 `openXxx()`，用 `openModal(html)` 弹层。
4. 需要台词的，加进 `persona.js`，不要写死在 `app.js`。
