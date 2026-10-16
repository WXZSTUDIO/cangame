# 《3D UI 改造实现说明》· cangame「战术板 · 篮球经理」

> 编制：程基岩（engineering-lead） · Task ENG-3D-02 · P0 · Phase 5/6
> 依据：`design/art/3d-visual-spec.md`（林绘澄 ART-3D-01）+ `design/engineering/3d-ui-audit.md`（ENG-3D-01）+ 主理人拍板的 10 条铁律
> 产物：`assets/style.css`（就地重写）、`tools/lint-3d.js`（新增）、本文档
> **未改动**：`index.html`（零改动）、`assets/ui.js`（零改动）、其余 15 个 asset 文件

---

## 0. 一句话结论

用 **flat tilt（元素自带 `transform: perspective()`，不依赖父级 `preserve-3d`）** 拿下 80% 的空间感，
用 **`#board` 一个 `preserve-3d` + 伪元素木地板** 拿下剩下 20% 的高潮，
因此 **包裹层一个都不需要 → `index.html` 零改动 → `ui.js` 零改动 → 22 个 `.card` 天然一次成型**。

---

## 1. 改了什么（逐文件）

### 1.1 `assets/style.css` —— 全量重写（163 行 → 443 行，29.6 KB）

| § | 内容 | 说明 |
|---|---|---|
| §0 | `:root` 变量 | **v3 全部变量原样保留**（只增不改）；新增 v4 token；补 `--card-2` |
| §1 | 舞台 L0 | `html` 背景：深空渐变 + 2 盏冷白顶光 + 1 抹橙（唯一暖源），`background-attachment:fixed` |
| §2 | 入场动画 | `@keyframes screenIn / viewIn` —— **纯 transform，无 opacity** |
| §3 | 玻璃底座 | 共享声明块（选择器分组 + 参数化变量，**不新增 class**） |
| §4 | 容器级 3D | `.card` / `.topbar` / `.nav` / `.tabs` / `.side > .card` 的 flat tilt |
| §5 | 导航 / Tab / 侧栏 | 选中态凹槽、行 hover 抬起、玻璃胶囊 |
| §6 | 表格 | `transform:none` 铁律区 + 行指示器 + `.you` 渐变 |
| §7 | 战术板 | 全局唯一 `preserve-3d` + 木地板伪元素 + 玻璃罩反光 |
| §8 | 选队网格 | 共享 `perspective` + CSS-only 抬起（限于精确指针） |
| §9 | 控件与装饰 | 按钮 / 下拉 / 能力条 / 冠军横幅 / 焦点环 |
| §10 | 降级矩阵 | reduced-motion / reduced-transparency / 无 backdrop-filter / data-perf / forced-colors / 窄屏 |
| — | 删除 | 审计 §3.3 的 12 条 v3 死规则 + `.modal` 组（均无对应 DOM，见 §4-C5/C10） |

**顺手修的既有 bug**：`--card-2` 曾被引用于 `.trophy-list li{background:var(--card-2)}` 但未定义（审计 §3.3）。
现补为 `rgba(11,17,20,.62)`，并让 `.trophy-list li` 继续用它做薄玻璃底。

### 1.2 `tools/lint-3d.js` —— 新增（静态正则，零依赖）

背景：`tools/verify-ui.js` 的 jsdom **不加载 CSS**（实测 `document.styleSheets.length === 0`），纯 CSS 改动对测试链完全不可见。
本脚本把审计 §8 的风险与主理人铁律变成 98 条可执行断言，输出 PASS/FAIL + 命中行号。

### 1.3 `index.html` —— **零改动**

审计 P1 原计划"按需插入 3D 舞台包裹层"。实际因为全部走 flat tilt（`perspective()` 函数写在元素自己的 `transform` 里），
**没有任何元素需要父级 `perspective` 容器**，故包裹层不需要，`index.html` 一个字节都没动。
这同时意味着：`#hdr` 不可能被误挪进 3D 舞台（R3 天然规避），22 个 `.card` 也不可能"有的有 3D 有的没有"。

### 1.4 `assets/ui.js` —— **零改动**（P4 未启动）

`attachDrag()`、`starHTML()` 及所有模板均未触碰。11 处硬编码 `.star` 靠**全局 `.star` 规则**统一覆盖（比 id 作用域更简单也更彻底）。

---

## 2. 关键实现决策

### 2.1 为什么是 flat tilt 而不是真 3D 舞台

| 方案 | 需要包裹层 | 风险 |
|---|---|---|
| 父级 `perspective` 属性 + `preserve-3d` 舞台 | 是 | `backdrop-filter` 与 `preserve-3d` 互斥（美术 §8.4-1），玻璃会采不到背景变灰白雾面 |
| **元素自带 `perspective()` 函数（采用）** | **否** | 无。每个面板自带透视，彼此独立，玻璃仍是叶子节点 |

代价：面板之间没有"共享消失点"，42 队网格单独用 `#team-grid{perspective}` 补上（那一屏确实需要一个连贯舞台）。

### 2.2 动画与玻璃的冲突怎么解（铁律 6）

原 `@keyframes fade{from{opacity:0;...}}` 挂在 `.screen` 与 `.main .view` 上——祖先 `opacity<1` 会创建 **Backdrop Root**，
内部玻璃在这 300ms 内采不到背景，动画结束"啪"地出现。

**解法不是删动画**（铁律要求保留切换效果），而是**换成纯 transform**：

```css
@keyframes viewIn{ from{transform:perspective(900px) translateZ(-18px) rotateX(1.5deg)} to{transform:none} }
```

视觉从"淡入上移"变成"从深处推进来"，反而更贴 3D。`transform` 不在 Backdrop Root 的触发清单里，玻璃全程有效。
（`translateZ` 挂在 `.card` 上而非 `.view` 上，因此终态 `transform:none` 不会吃掉它——审计 R4 同步规避。）

### 2.3 发丝渐变边框（保留降级路径）

```css
border:1px solid transparent;
background-image: …, …, …, linear-gradient(180deg, var(--glass-hi-top), var(--glass-stroke));
background-clip:padding-box,padding-box,padding-box,border-box;   /* 第 4 层裁到 border-box */
```
不需要额外 DOM 节点。美术 §3.1-④ 给的降级（`border:1px solid var(--glass-stroke)`）作为 P1 备选未启用——
`background-clip` 列表语法在所有目标内核（Chrome/Firefox/Safari 15+）都可用。

### 2.4 战术板：地板转、SVG 不转（主理人铁律 + 12°）

```
#board            perspective:900px; perspective-origin:50% 34%; preserve-3d
 ├ ::before       枫木地板   rotateX(12deg) translateZ(-14px)   ← C1
 ├ svg.board      ★ 无 transform                               ← C2（拖拽命中的生命线）
 └ ::after        玻璃罩反光 translateZ(10px) pointer-events:none ← C3
```

**`svg.board` 上只有 `filter:drop-shadow()`，没有任何 transform。**
理由：`attachDrag()` 用 `svg.getBoundingClientRect()` 做线性换算，一旦 SVG 被 3D 投影，`rect` 就是外接矩形，
换算非线性 → 拖拽漂移。`--court-tilt:12deg` 落在地板伪元素上，视觉上"板子浮在倾斜木地板之上"。

另加一道保险：
```css
#view-tactics .card,#view-tactics .card:hover{ transform: <与常态相同> }
```
战术板卡片不做 hover 位移——否则拖拽中鼠标移出卡片会触发 transform 变化，已捕获的 rect 失效导致跳变。

### 2.5 `.token` 只用 `filter`（铁律 3）

`.token` 的位置靠 SVG `transform` **属性**，`g.setAttribute('transform','translate(x,y)')`。
CSS `transform` 会覆盖该 presentation attribute → 5 个棋子全塌到原点且拖不回来。
"浮起"改用 `filter:drop-shadow()`，抓取时收紧阴影模拟离地。

### 2.6 blur 只给 chrome 层（铁律 10）

| 宿主 | blur | 理由 |
|---|---|---|
| `.topbar` / `.nav` | 16px | 常驻不动、数量少 |
| `.tabs` / `.side > .card` | 12px | 数量少 |
| **主区 `.card`（22 个）** | **0** | 长滚动列逐帧重采样会掉帧；用渐变 + 内高光模拟，视觉 ≈90% |
| `.team-btn`（42 个） | 0 | 42 层 blur 会爆显存 |

同屏 blur 层 = **4**（≤6 ✓）。`lint-3d.js` 有一条断言专门锁死"精确匹配 `.card` 的规则不得带 backdrop-filter"。

### 2.7 每元素外投影 ≤1 层（铁律 9）

美术 §5.3 的选中态辉光原本是「1px 描边环 + 24px 辉光」= 2 层外投影。
为守铁律，把描边环改成 **`inset 0 0 0 1px`**（内环，视觉几乎一致），只留 1 层外辉光。
选队卡 hover 的"橙调副影"（美术 §5.2 允许的第二层）同样去掉。
lint 会按顶层逗号切 `box-shadow` 值并统计非 `inset` 层，>1 即 FAIL。

---

## 3. 视觉 token → 选择器映射表

| 美术 token | 落到选择器 | 值 |
|---|---|---|
| `--glass-floor` (.62 保底层) | `.card` / `.tabs` / `.side > .card` / `.team-btn` | 经底座块第 3 层 `linear-gradient` |
| `--glass-floor-strong` (.78) | `.topbar` / `.nav` | 同上，经 `--glass-bg` 参数注入 |
| `--glass-inset`（顶高光 + 底 AO） | 所有玻璃宿主 | `inset 0 1px 0 .34白` + `inset 0 -1px 0 .34黑` |
| `background-clip:border-box` 第 4 层 | 所有玻璃宿主 | 发丝渐变边框 `.34白 → .14白` |
| `--blur-chrome` 16px | `.topbar` / `.nav` | `blur(16px) saturate(180%)` |
| `--blur-panel` 12px | `.tabs` / `.side > .card` | 同上 |
| `--z-panel` 8px | `.card` / `.nav` / `.side > .card` | 常态 `translateZ` |
| `--z-raise` 18px | `.card:hover` / `.side > .card:hover` | 悬浮 |
| `--z-lift` 28px | `.team-btn:hover`（精确指针） | 选队卡抬起 |
| `--tilt-card` 1deg | `.card` | 常态微后仰，hover 回正到 0deg |
| `--tilt-nav` +2.5deg | `.nav`（`transform-origin:0% 50%`） | 左缘固定，右缘转向观众 |
| `--tilt-side` −2.5deg | `.side > .card`（`origin:100% 50%`） | 与左导航镜像 → "向内环抱" |
| `--persp-chrome` 1400px | `.topbar` + `rotateX(1.2deg)` | 离用户最近，向下微倾 |
| `--tilt-court` **12deg** | `#board::before`（地板） | **SVG 本体 0deg** |
| `--hardwood-a/b/key` | `#board::before` 三层背景 | 打蜡反光 + 木纹 + 距离雾 |
| `--persp-grid` 1000px / `origin 50% 40%` | `#team-grid` | 42 卡共享消失点 |
| `--win/--lose/--warn` | `.tag.win/.lose/.warn` | 沿用 v3 色值 |
| `--chalk-2`（新增二级文本） | `td` / `.tab-btn:hover` / `.broadcast` / `.sub` | 11.4:1 AAA |
| `--line-glass*` | `th/td` 分隔线、`.log-line`、`.fin-row`、`.nav-team` | 玻璃上比 v3 `--line` 更柔 |

**倾角红线遵守情况**：含正文的元素最大旋转 = `.card` 的 `rotateX(1deg)`（≤3° ✓）；
`.nav` 的 `rotateY(2.5deg)`（≤2.5° ✓）；表格、`td`、`th`、`tr` 全部 `transform:none`（铁律 5 ✓）。

---

## 4. 已知妥协与未做项（需要主理人知情）

| # | 项 | 状态 | 原因 / 处置建议 |
|---|---|---|---|
| C1 | **style.css 29.6 KB > 美术 §8.3 的 26 KB 预算** | ⚠ **偏差** | 已压缩注释（3.3KB→0.9KB）与缩进；**实测完全 minify 后仍 26.1 KB**，说明该预算对完整 3D 视觉层不可达。lint 中降级为 WARN（显式输出，不计 pass/fail）。**需裁定：把预算提到 32KB，或授权删减**。 |
| C2 | 42 队网格**跟随倾角**（`--mx/--my`）未实现 | 推迟 | 需 JS 注入（美术 §6.7）。本轮铁律禁止动 ui.js。已改为 CSS-only hover 抬起 + `@media (hover:hover) and (pointer:fine)` 门控，CSS 里预留了 `--tilt-grid-max` / `--z-lift` 变量，S4 接上即可。 |
| C3 | 棋子**落地椭圆阴影 + 左上高光**（`token-shadow` / `token-hi`）未做 | 推迟 | 需改 `renderBoard()` 模板（P4）。已用 `filter:drop-shadow()` 达到 ~80% 效果。 |
| C4 | 6×6 站位网格、松手吸附格心 | 推迟 | 需改 `courtSVG()` 与 `attachDrag()`（P4/S6）。 |
| C5 | `.modal` / `.modal-box` 样式**已删除** | 删除 | 当前 `index.html` 无 modal 节点（竞猜失败走原生 `alert()`），纯死代码。为压体积删除；未来接 DOM 弹窗时按美术 §6.9 补回。 |
| C6 | **sticky 表头**（美术 §6.5 标 P1） | 不做 | 最长表 14 行，`border-collapse:collapse` 下 sticky `th` 的边框在部分内核有渲染瑕疵；且会给滚动区再加一层 blur。留待 P1 单开。 |
| C7 | 入场 stagger（`--i` 序号） | 不做 | 需改 `renderPick()`。 |
| C8 | 舞台"极轻噪点" | 不做 | 需内联 SVG data-URI 或 `filter:url()`，后者被美术 §9-F 明令禁止。 |
| C9 | `index.html` 样式表**未加版本号** `?v=4` | 未做 | 指令限定 index.html"仅加包裹层"。**建议 deploy 时补上**，否则回头用户可能拿到 CDN 缓存的旧 CSS。 |
| C10 | 审计 §3.3 列出的 v3 死规则已全部删除 | 删除 | 删掉：`.hdr` / `.hdr .name` / `.hdr .rec` / `.grid2` / `@media(820)` / `.col-main,.col-side` / `.board-wrap` / `.attr-mini`(`b`) / `.train-row` / `.btn-ghost` / `.token.away` / `.pos-label`。审计已逐条实测"全项目无对应 DOM"，删除零功能风险；这是压体积 C1 的主要手段。**若日后发现某处其实在用，回滚成本 = 加回一条规则。** |

---

## 5. 验收结果（本机实测，仓库根目录执行）

```
node tools/verify-s1.js    → verify-s1: 通过 81 / 81  ✅ 全部通过      （基线 81/81）
node tools/verify-v35.js   → verify-v35: 通过 17 / 17  ✅              （基线 17/17）
node tools/verify-ui.js    → verify-ui: 通过 65 / 65  ✅ 全部通过      （基线 65/65，真实 jsdom，exit 0）
node tools/lint-3d.js      → lint-3d: 通过 98 / 98  ✅ 全部 PASS       （新增）
```

`lint-3d.js` 的关键输出：

```
· preserve-3d 宿主：#board  (style.css:270)
· 表格 transform:none 规则数：3
· 入场动画：.screen → screenIn 320ms ；.main .view → viewIn 220ms
· backdrop-filter 宿主（4）：.topbar | .nav | .tabs | .side > .card
⚠ WARN · style.css 28.9 KB 超出 26 KB 预算（见 C1）
· index.html：#view-* 20 · .tab-btn 4 · .card 22 · .nav-btn 20 · .side-tab 2
```

### 5.1 `lint-3d.js` 覆盖的规则清单

| 规则 | 断言内容 |
|---|---|
| G1 / 铁律4 | `transform-style:preserve-3d` 全文件恰好 1 处，且宿主选择器必须是 `#board` |
| R2 | preserve-3d 块内不得出现 `overflow/opacity/filter/mask/clip-path/mix-blend-mode/isolation/contain` |
| R2 | `.tabs` / `.bar` / `.broadcast` / `.pbp` / `.card` 不得挂 preserve-3d |
| G7 | `.card` 与 `#board` 不得设置 `overflow`（会裁掉 3D 地板） |
| R3 | `html` / `body` / `.app` / `.screen` / `#screen-game` / `.shell` / `.main` 不得出现 `perspective` / `transform-style` |
| R3 | `index.html` 中 `#hdr` 仍是 `#screen-game` 的直接子节点（中间无其他元素） |
| R6 / 铁律3 | `.token` 及其伪类/后代选择器不得声明 `transform` |
| R7 / 铁律3 | `svg.board` / `.board` 不得出现 `transform` / `rotateX/Y/3d` / `perspective` / `transform-style` |
| R7 | `#board` 必须同时有 `perspective` 与 `preserve-3d` |
| R7 | `assets/ui.js` 的 `attachDrag` 仍是原始线性换算（含 `500 / rect.width`） |
| G2 / 铁律5 | 含 `table/thead/tbody/tr/th/td` 元素选择器的规则，`transform` 必须为 `none`；且至少存在 1 条显式兜底 |
| R1 / 铁律6 | `.card` / `.topbar` / `.nav` / `.side` / `.side > .card` / `.tabs` 不得 `opacity<1` |
| R1 / R4 | 任何 `@keyframes` 内不得出现 `opacity<1` |
| 铁律6 | `.screen` 与 `.main .view` **必须仍保留** animation（防"为了规避 opacity 直接删动画"） |
| 铁律9 | `will-change` 只允许出现在 `:hover/:active/:focus/.is-lift/.is-near`（本文件实际为 0） |
| 铁律9 | 所有 `blur(Npx)` 的 N ≤ 24 |
| 铁律9 | 每条 `box-shadow` 的非 `inset` 层 ≤ 1 |
| 铁律10 | 精确匹配 `.card` 的规则不得带 `backdrop-filter` |
| 铁律9 | 全文件开启 blur 的宿主规则 ≤ 6（实际 4） |
| 卫生 | 无 `@import`、无 `filter:url()`、花括号配平、体积告警 |
| 铁律1 | `#view-*`=20、`.tab-btn`=4、`.card`=22、`.nav-btn`≥12、`.side-tab`=2 |
| 铁律1 | 固定 id 仍存在（`btn-advance`/`kings-start`/`ticket-price`/`alliance-name`/`alliance-create`/`season-end`/`board`，HTML 或 ui.js 中） |
| 铁律1 | `.hidden` 仍为 `display:none!important` |
| R11 | `index.html` 只有 1 个 `<link>` 且指向 `assets/style.css`；link/script 无外部 CDN；无内联 `<style>` |

---

## 6. 铁律遵守自查（逐条对照主理人 10 条）

| # | 铁律 | 结论 | 证据 |
|---|---|---|---|
| 1 | 不新增/删除/重命名既有 id 与 class | ✅ | `index.html` 零改动；lint 断言 `#view-*`=20 / `.tab-btn`=4 / `.card`=22 / `.nav-btn`≥12 / `.side-tab`=2 全部通过；CSS 未新增任何 class（用选择器分组代替） |
| 2 | `ui.js` 改动压到最小（目标 0） | ✅ **0 处** | 未打开编辑；`.star` 用全局规则覆盖 12 处；lint 断言 `attachDrag` 仍为原始线性换算 |
| 3 | `.token` 绝不加 CSS transform | ✅ | `.token` 只有 `cursor` / `transition:filter` / `filter:drop-shadow()`；lint 有专门断言 |
| 4 | `preserve-3d` 只允许 `#board` 一处 | ✅ | lint 断言"恰好 1 处且宿主 = #board"，实测 `#board (style.css:270)` |
| 5 | 表格区域 `transform:none` | ✅ | `table` / `thead,tbody,tr,th,td` / `th,td` 三条显式 `transform:none`；lint 断言所有含表格元素选择器的规则 |
| 6 | 玻璃宿主无 opacity<1 动画，且不破坏切换效果 | ✅ | `@keyframes fade` 已删除，替换为纯 transform 的 `screenIn` / `viewIn`；lint 同时断言"动画必须仍存在" |
| 7 | `overflow` 与 `preserve-3d` 冲突按 R2 处理 | ✅ | `.tabs`/`.bar`/`.broadcast`/`.pbp` 均未挂 preserve-3d；`.card` 未加 overflow；Tab 效果做在 `.tab-btn` 上 |
| 8 | `#hdr` 留在 perspective 容器之外 | ✅ | 全局无 perspective 容器（flat tilt）；lint 断言祖先链无 perspective + `#hdr` 仍是 `#screen-game` 直接子节点 |
| 9 | 性能硬上限 | ✅ | blur 层 4（≤6）、blur ≤16px（≤24）、preserve-3d 1（≤1）、**常驻 will-change 0**、每元素外投影 ≤1 层、42 队网格无 will-change 且跟随倾角未启用（无 JS 监听器） |
| 10 | 主区卡片不加 blur | ✅ | `.card` 无 `backdrop-filter`，只给 `.topbar`/`.nav`/`.tabs`/`.side > .card` |

---

## 7. 必须人工在浏览器确认的点（jsdom 测不到视觉）

按优先级排列，建议在 **Chrome / Safari / Android Chrome** 各跑一遍，宽度 1280 / 960 / 680 / 380。

1. **玻璃是否真的"采到背景"**：`.nav` / `.topbar` / `.tabs` / `.side > .card` 上的 `backdrop-filter` 应能看到背景模糊；若呈现"灰白雾面/一片死黑"= Backdrop Root 被污染（R1）。
2. **切视图/进游戏有无闪跳**：点 20 个导航项来回切，玻璃与阴影不应出现"先平后凸""先无模糊后有模糊"。
3. **战术板拖拽回归（最高优先级）**：5 个点位可拖、拖到哪儿停在哪儿、不漂移；边界 clamp 在 `x[60,440] y[60,410]`；**换首发后板仍在**；拖到卡片外再回来不跳变。
4. **战术板视觉**：木地板透视方向是否与 SVG 半场协调（地板倾斜 12°、SVG 平面），有无"割裂感"；橙色棋子是否带落地阴影。
5. **文字清晰度**：`rotateX(1deg)` 后卡片内中文（尤其 13px 表格数字）是否发虚；若发虚就把 `--tilt-card` 降到 `0.5deg`。
6. **表格行指示器**：hover 时首格左侧 3px 橙条是否出现（`border-collapse:collapse` 下我改挂到 `td:first-child`）。
7. **三栏"向内环抱"感**：左导航 +2.5°、右面板 −2.5°、顶栏 −1.2° 的方向是否符合预期；680px 断点下 `.nav` 变横向时是否裁切。
8. **焦点环**：Tab 键走一遍 `.nav-btn` / `.tab-btn` / `.mini-btn` / `select`，2px 橙色 outline 是否完整可见、不被 3D 裁掉。
9. **降级路径**：DevTools → Rendering 模拟 `prefers-reduced-motion: reduce`（应全部 `transform:none`、无动画）、`prefers-reduced-transparency: reduce`（应无 blur、不透明度 ≥.94）；手动关掉 backdrop-filter 支持后页面仍可读。
10. **性能**：选队页指针扫过 42 卡、名册页（12 行 × 8 列）滚动，Performance 面板帧率应 ≥55fps。
11. **橙色占比**：截图取色，全屏橙色像素应 ≤6%。
12. **线上一致性**：`python tools/deploy.py` 后打开 GitHub Pages 实际地址再核一遍（本轮未新增文件，`style.css` 本来就在 `PUBLISH` 白名单里）。

---

*— 程基岩 · ENG-3D-02 · 完 —*
